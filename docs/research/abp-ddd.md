# Khảo sát: các khối xây dựng DDD của ABP Framework và cách áp dụng cho NestJS + TypeORM

**Ngày khảo sát:** 2026-11-27
**Đối tượng đọc:** Tech Lead backend

## 1. Câu hỏi và bối cảnh

Backend của sản phẩm là một ứng dụng NestJS, hiện mới là bộ khung. Sản phẩm là SaaS cho các đại lý hải quan Việt Nam; mỗi **Agency** là một **Organization**: đơn vị thuê hệ thống và ranh giới dữ liệu, tương ứng khái niệm tenant của ABP. Các dependency backend đã khai báo gồm `@nestjs/typeorm` 12, `typeorm` 1.1, `@nestjs/event-emitter` 12 và `@nestjs/bullmq` 12, chạy trên NestJS 12.

Hai ứng viên aggregate chính:

- **Job** (bộ hồ sơ một lô hàng), có ba trạng thái: Đang làm, Đã đóng, Đã hủy.
- **Customs Declaration** (tờ khai hải quan), có sáu trạng thái do Declaration Staff chọn bằng tay, với các phép chuyển cố định.

Bất biến tiêu biểu: một Job chỉ được đóng khi có ít nhất một Customs Declaration đã thông quan và mọi Customs Declaration còn lại đều đã thông quan hoặc đã hủy.

Một khảo sát trước đó về các dự án NestJS mã nguồn mở theo DDD đã khuyến nghị:

- bốn tầng `api` / `application` / `domain` / `infrastructure` trong mỗi module;
- mô hình hóa aggregate theo kiểu rút gọn của `Sairyss/domain-driven-hexagon`: props ẩn, factory tĩnh `create()`, phương thức nghiệp vụ tự thu thập domain event, `validate()` kiểm tra bất biến;
- Job là aggregate root, Customs Declaration là entity con bên trong Job;
- repository viết riêng cho từng aggregate (không dựng repository generic), cài bằng TypeORM, có mapper giữa TypeORM entity và aggregate; truy vấn chỉ để hiển thị được phép đọc thẳng qua TypeORM trong application service;
- chưa dùng `CommandBus`/`QueryBus`;
- phát domain event bằng `@nestjs/event-emitter` **sau khi commit**, ngoài transaction; chuyển sang transactional outbox với BullMQ khi event không được phép mất;
- mọi phương thức đọc của repository nhận `organizationId` bắt buộc.

Tài liệu này trả lời: ABP Framework (.NET) định nghĩa từng khối xây dựng DDD ra sao; phần nào gắn với .NET/EF Core nên không mang thẳng sang NestJS + TypeORM được; NestJS có gì tương đương và còn được bảo trì; và so với khuyến nghị trên thì chỗ nào nên theo ABP, chỗ nào không.

Mọi nhận định về ABP lấy từ tài liệu chính thức tại `abp.io/docs/latest`, đọc ngày 2026-11-27. Khi tài liệu không nói về một điểm, tài liệu này ghi rõ "nguồn không nói", không suy đoán.

## 2. Tổng quan cách ABP chia tầng

ABP mô tả bốn tầng: Presentation, Application, Domain, Infrastructure. Tầng Domain "includes business objects and the core (domain) business rules. This is the heart of the application"; tầng Application "mediates between the Presentation and Domain Layers" ([Domain Driven Design](https://abp.io/docs/latest/framework/architecture/domain-driven-design)).

Khối xây dựng theo tầng:

- **Domain:** Entity và Aggregate Root, Repository (interface), Domain Service, Value Object, Specification.
- **Application:** Application Service, DTO, Unit of Work.

Bốn tầng này khớp với bốn tầng của khuyến nghị trước (`api` tương ứng Presentation). ABP còn tách một gói "application contracts" chứa interface của application service và DTO, để client .NET dùng chung ([Application Services best practices](https://abp.io/docs/latest/framework/architecture/best-practices/application-services)). Backend này không có client .NET nào dùng lại contract, nên không cần gói đó.

## 3. Từng khối xây dựng

### 3.1 Entity

**ABP định nghĩa.** `Entity<TKey>` cung cấp thuộc tính `Id`; khóa ghép dùng lớp `Entity` không generic và ghi đè `GetKeys()` ([Entities](https://abp.io/docs/latest/framework/architecture/domain-driven-design/entities)). Quy tắc best practice ([Entities best practices](https://abp.io/docs/latest/framework/architecture/best-practices/entities)):

- "Do define a primary constructor that ensures the validity of the entity on creation."
- "Do always initialize sub-collections in the primary constructor."
- "Do not generate `Guid` keys inside the constructor. Get it as a parameter." Id được sinh bằng `IGuidGenerator` (GUID tuần tự, tốt cho clustered index), không dùng `Guid.NewGuid()`.
- Setter để `private`/`protected`/`internal`; thay đổi thuộc tính qua phương thức.
- "Do keep the entity as always **valid** and **consistent** within its own boundary."

ABP còn có các lớp audit sẵn (`CreationAuditedEntity<TKey>`, `AuditedEntity<TKey>`, `FullAuditedEntity<TKey>`), xóa mềm qua `ISoftDelete`, và `ExtraProperties` (từ điển thuộc tính động). Chính tài liệu ABP khuyên không dùng `ExtraProperties` cho entity của mình vì "It is **not fully type safe**".

**Phần gắn với .NET/EF Core.**

- "Do always define properties and methods as `virtual`" và "Do always define a `protected` parameterless constructor to be compatible with ORMs": đây là yêu cầu của proxy lazy-loading và của cách EF Core dựng object. TypeScript không cần.
- Constructor con để `internal` nhằm chỉ tầng domain tạo được entity con. TypeScript không có `internal`; gần nhất là không export factory của entity con ra ngoài module, hoặc chỉ tạo entity con qua phương thức của aggregate root.
- Các trường audit (`CreatorId`, `LastModifierId`) được ABP tự điền nhờ interceptor của EF Core. TypeORM có `@CreateDateColumn`/`@UpdateDateColumn` cho thời gian, còn "ai tạo/ai sửa" phải tự gán trong application service hoặc dùng subscriber.

**Tương đương NestJS.** Không cần thư viện. Lớp nền `Entity` vài chục dòng viết tay (như khuyến nghị trước) là đủ. Id có thể sinh ở application service rồi truyền vào factory (đúng quy tắc "Get it as a parameter" của ABP), ví dụ UUID v7 để có thứ tự theo thời gian.

### 3.2 Aggregate root

**ABP định nghĩa.** `AggregateRoot<TKey>` kế thừa `Entity<TKey>`, cài thêm `IHasExtraProperties` và `IHasConcurrencyStamp`; `BasicAggregateRoot<TKey>` là bản bỏ các tính năng đó ([Entities](https://abp.io/docs/latest/framework/architecture/domain-driven-design/entities)). Quy tắc:

- "An aggregate root can be referenced by its `Id`. Do not reference it by its navigation property."
- Aggregate được đọc và cập nhật như một đơn vị, thường là ranh giới transaction.
- "Work with sub-entities over the aggregate root- do not modify them independently."
- "Do keep aggregates **as small as possible**." ([best practices](https://abp.io/docs/latest/framework/architecture/best-practices/entities))
- "Do use **Guid** as the **primary key** of all aggregate roots." và "Do not use **composite keys** for aggregate roots."

**Concurrency.** ABP tự quản `ConcurrencyStamp` để chống ghi đè lạc quan (optimistic concurrency): hai người sửa cùng một aggregate, người lưu sau bị từ chối.

**Domain event.** Aggregate root thu thập event bằng `AddLocalEvent` hoặc `AddDistributedEvent`; "Calling the `AddLocalEvent` doesn't immediately publish the event" ([Local Event Bus](https://abp.io/docs/latest/framework/infrastructure/event-bus/local)). Thời điểm phát xem mục 3.8.

**Phần gắn với .NET/EF Core.**

- `ConcurrencyStamp` hoạt động nhờ concurrency token của EF Core: câu `UPDATE` tự thêm điều kiện trên stamp. TypeORM có `@VersionColumn`, nhưng tài liệu TypeORM chỉ nói cột này "is automatically set to the version of the entity (incremental number) each time you call `save`" ([Entities](https://typeorm.io/docs/entity/entities)), không nói `save()` kiểm tra version. Trong mã nguồn TypeORM, lỗi `OptimisticLockVersionMismatchError` chỉ được ném trong `SelectQueryBuilder`, tức là khi **đọc** với `lock: { mode: "optimistic", version }` ([`SelectQueryBuilder.ts`](https://github.com/typeorm/typeorm/blob/b1e211fc2654d412612a08f8a7fb890f3352614f/packages/typeorm/src/query-builder/SelectQueryBuilder.ts)). Kiểm tra lúc đọc không chặn được hai người cùng đọc version 5 rồi cùng ghi. Muốn có hành vi như ABP, repository phải tự ghi bằng `UPDATE ... WHERE id = :id AND version = :expectedVersion` rồi kiểm tra số dòng bị ảnh hưởng, hoặc khóa bi quan `SELECT ... FOR UPDATE` trong transaction. Version phải đi qua mapper vào aggregate để biết "version đã đọc".
- Domain event được EF Core phát khi `SaveChanges`. TypeORM không có điểm móc tương đương gắn với aggregate; repository hoặc application service phải tự lấy event ra (`pullEvents()`).

**Tương đương NestJS.** Lớp nền `AggregateRoot` viết tay, giữ danh sách event (như khuyến nghị trước), thêm thuộc tính `version` để repository dùng cho kiểm tra concurrency. Nếu sau này dùng `@nestjs/cqrs`, lớp `AggregateRoot` của gói này cũng chỉ là bộ thu thập event, không có concurrency.

**Áp dụng cho Job.** Quy tắc "sửa entity con qua aggregate root" và "không sửa entity con độc lập" của ABP xác nhận lựa chọn Customs Declaration là entity con của Job: bất biến đóng Job cần thấy toàn bộ Customs Declaration trong cùng một lần đọc–ghi. Quy tắc "giữ aggregate nhỏ" là điều kiện để xem lại: nếu một Job có rất nhiều tờ khai hoặc nhiều Declaration Staff sửa các tờ khai khác nhau của cùng Job cùng lúc, mỗi lần sửa tờ khai sẽ va chạm version của cả Job.

### 3.3 Value object

**ABP định nghĩa.** `ValueObject` là lớp trừu tượng; lớp con phải cài `GetAtomicValues()` trả về các giá trị nguyên thủy; so sánh bằng `ValueEquals(...)`. Value object không có `Id`, hai value object bằng nhau khi các thuộc tính bằng nhau. Best practice: ưu tiên bất biến (immutable), và "The properties that make up a Value Object should form a conceptual whole" ([Value Objects](https://abp.io/docs/latest/framework/architecture/domain-driven-design/value-objects)).

**Phần gắn với .NET/EF Core.** Trang này không nói cách lưu value object (nguồn không nói về owned type của EF Core). Ví dụ có constructor không tham số `private`, phục vụ ORM.

**Tương đương NestJS.** Lớp nền value object viết tay, so sánh theo giá trị (như `domain-driven-hexagon`). Lưu bằng TypeORM qua embedded entity (`@Column(() => Address)`) hoặc tách cột trong mapper. Khuyến nghị trước "chỉ dùng value object cho khái niệm có quy tắc riêng" không mâu thuẫn với ABP; ABP cũng không đòi mọi chuỗi phải thành value object.

### 3.4 Repository

**ABP định nghĩa.** ABP có repository generic `IRepository<TEntity, TKey>` với `GetAsync`, `FindAsync`, `InsertAsync`, `UpdateAsync`, `DeleteAsync`, `GetListAsync`, `GetPagedListAsync`, `GetCountAsync`, và `GetQueryableAsync()` trả về `IQueryable<TEntity>`; các interface hẹp hơn là `IReadOnlyRepository` và `IBasicRepository` ([Repositories](https://abp.io/docs/latest/framework/architecture/domain-driven-design/repositories)). Chính tài liệu cảnh báo: "Exposing `IQueryable` outside of a repository class may leak your data access logic to the application layer."

Best practice của ABP chặt hơn cơ chế generic ([Repositories best practices](https://abp.io/docs/latest/framework/architecture/best-practices/repositories)):

- Interface repository đặt ở tầng domain; mỗi aggregate root một interface riêng kèm cài đặt.
- Code ứng dụng dùng interface riêng, không dùng `IRepository<...>` generic, và không dùng tính năng `IQueryable`.
- Không kế thừa `IRepository<TEntity, TKey>` vì nó lộ `IQueryable`; kế thừa `IBasicRepository` nếu cần.
- "Don't define repositories for entities that aren't aggregate roots."
- Phương thức trả một entity có tham số `includeDetails` mặc định `true`; phương thức trả danh sách mặc định `false`.
- Không tạo lớp ghép kiểu "UserWithRoles", tránh lớp chiếu (projection) chỉ chứa một phần thuộc tính, trừ khi hiệu năng là then chốt.

Repository xóa mềm: `DeleteAsync` không xóa thật nếu entity là `ISoftDelete`; `HardDeleteAsync` xóa thật.

**Phần gắn với .NET/EF Core.**

- `IQueryable` + LINQ là cây biểu thức được EF Core dịch sang SQL. TypeScript không có cơ chế này; `Repository<T>` của TypeORM với `find({ where })` hay `QueryBuilder` là API riêng của TypeORM, đưa ra tầng application thì tầng đó phụ thuộc TypeORM.
- Change tracking: EF Core theo dõi entity đã tải và tự sinh `UPDATE` lúc `SaveChanges`. `DisableTracking()`, `[DisableEntityChangeTracking]` và việc read-only repository trả entity không được theo dõi đều dựa trên cơ chế này. TypeORM không có change tracker theo phiên: `save()` "Saves a given entity or array of entities. If the entity already exist in the database, it is updated" và "all undefined properties are skipped" ([Repository API](https://typeorm.io/docs/working-with-entity-manager/repository-api)). Mỗi lần lưu phải gọi tường minh.
- Đáng chú ý: chính ABP yêu cầu application service "call the repository's `Update`/`UpdateAsync` explicitly after changes, since not all database APIs track changes" ([Application Services best practices](https://abp.io/docs/latest/framework/architecture/best-practices/application-services)). Nghĩa là code ABP viết đúng chuẩn không dựa vào change tracking, nên `repository.save(job)` tường minh trong NestJS là bản chuyển đúng.
- `includeDetails`/`WithDetailsAsync`/lazy loading dựa trên navigation property của EF Core. Với TypeORM, repository tự quyết định nạp quan hệ (`relations`) trong cài đặt.
- Repository mặc định được sinh tự động cho mọi aggregate root (`AddDefaultRepositories`, [EF Core integration](https://abp.io/docs/latest/framework/data/entity-framework-core)). NestJS không có; `@InjectRepository(Entity)` của `@nestjs/typeorm` cho repository của TypeORM entity, không phải của aggregate.

**Tương đương NestJS.** Interface repository viết tay ở `domain/`, token DI, cài đặt TypeORM ở `infrastructure/` có mapper. Không cần thư viện. Điều kiện để cài đặt này tham gia transaction xem mục 3.8.

**Áp dụng cho Job.** `JobRepository.findById(organizationId, jobId)` **luôn** nạp đủ mọi Customs Declaration, vì bất biến đóng Job cần chúng. Không có tham số `includeDetails`: với aggregate ghi, nạp thiếu entity con là cách phá bất biến dễ nhất. Customs Declaration không có repository riêng, đúng quy tắc ABP.

### 3.5 Domain service

**ABP định nghĩa.** Kế thừa `DomainService` hoặc cài `IDomainService`; đặt tên hậu tố `Manager` (ví dụ `IssueManager`). Domain service là lớp "simple, stateless", dùng khi logic lõi cần service khác như repository, hoặc khi logic "is related to more than one aggregate/entity". Phân biệt: "Application Services implement the use cases of the application", còn "Domain Services implement the core, use case independent domain logic" ([Domain Services](https://abp.io/docs/latest/framework/architecture/domain-driven-design/domain-services)). Đặt setter của aggregate là `internal` để buộc mọi lời gọi đi qua `IssueManager`.

Best practice ([Domain Services best practices](https://abp.io/docs/latest/framework/architecture/best-practices/domain-services)):

- Không tạo interface cho domain service nếu không có lý do (mock, nhiều cài đặt).
- Không có phương thức GET; phương thức phải thay đổi trạng thái entity.
- Tên phương thức tự giải thích (`AssignToAsync`), không đặt tên chung chung như `UpdateIssueAsync`.
- Nhận domain object hợp lệ, không trả DTO.
- Lỗi nghiệp vụ ném `BusinessException` có mã lỗi riêng để bản địa hóa.
- Không đọc người dùng hiện tại bên trong domain service; application service truyền vào.

Trong ví dụ của ABP, domain service chỉ đổi trạng thái; application service mới gọi `UpdateAsync` để lưu. Nguồn không nêu quy tắc cấm domain service gọi `UpdateAsync`.

**Phần gắn với .NET.** Đăng ký DI tự động (Transient) theo lớp nền, và mẹo `internal` setter. Phần còn lại là thuần thiết kế, mang sang được.

**Tương đương NestJS.** Một provider thường của NestJS ở `domain/`, không import gì từ tầng infrastructure. Khi cần repository thì inject interface qua token.

**Áp dụng cho Job.** Chừng nào Customs Declaration còn là entity con, bất biến đóng Job nằm gọn trong `Job.close()`, không cần `JobManager`. Nếu sau này tách Customs Declaration thành aggregate riêng (tham chiếu Job bằng id), quy tắc đóng Job sẽ liên quan hai aggregate và cần repository để đọc tờ khai; lúc đó mẫu `Manager` của ABP là chỗ đặt logic: `JobManager.close(job, declarations)` nhận domain object, không nhận DTO, không đọc người dùng hiện tại.

### 3.6 Application service

**ABP định nghĩa.** Application service cài `IApplicationService`, có thể kế thừa `ApplicationService`; "Application services get and return DTOs instead of entities" ([Application Services](https://abp.io/docs/latest/framework/architecture/domain-driven-design/application-services)). `CrudAppService` sinh sẵn Get/GetList/Create/Update/Delete. Input được kiểm tra tự động bằng data annotation; phân quyền khai báo theo permission; mapping entity sang DTO qua `ObjectMapper` (mặc định Mapperly). Lifetime transient.

Best practice ([Application Services best practices](https://abp.io/docs/latest/framework/architecture/best-practices/application-services)):

- Một application service cho mỗi aggregate root.
- Dùng repository riêng (`IProductRepository`), không dùng repository generic.
- "Do not write LINQ or SQL queries" trong application service; đặt truy vấn trong repository.
- Luôn nạp entity liên quan từ repository trước khi thao tác.
- Gọi `Update`/`UpdateAsync` tường minh sau khi thay đổi.
- Không dùng kiểu của tầng web (`IFormFile`, `Stream`).
- Không gọi application service khác trong cùng module; dùng tầng domain.

**Phần gắn với .NET/ABP.**

- "Auto API controllers": ABP tự sinh HTTP endpoint từ application service. NestJS không có; controller/resolver viết tay gọi application service (đúng khuyến nghị trước).
- `CrudAppService`: dễ dụ dỗ viết CRUD chung chung cho Job, trái với việc Job đổi trạng thái qua phương thức nghiệp vụ.
- Validation tự động bằng data annotation tương đương `ValidationPipe` + `class-validator` của NestJS, nhưng chạy ở tầng controller, không phải ở application service.
- Phân quyền theo permission chạy bằng interceptor trên method; NestJS làm bằng guard ở controller/resolver.

**Tương đương NestJS.** Provider thường ở `application/`. Không cần `@nestjs/cqrs` (khuyến nghị trước đã quyết chưa dùng `CommandBus`/`QueryBus`).

### 3.7 DTO

**ABP định nghĩa.** "ABP doesn't force you to use DTOs, however using DTOs is strongly suggested as a best practice." Lý do: tách presentation khỏi domain, giấu dữ liệu không cần ("Not more, not less"), và tránh sự cố khi serialize entity (lazy loading, vòng tham chiếu) ([Data Transfer Objects](https://abp.io/docs/latest/framework/architecture/domain-driven-design/data-transfer-objects)). Quy tắc:

- "Do not inherit DTOs from entities and do not reference to entities."
- "DTOs should not contain any business logic, except some formal validation code."
- "Define only the properties needed for the use case."
- "Don't reuse input DTOs among different application service methods."
- "You can reuse output DTOs if you fill all the properties on all the cases."

Lớp DTO chuẩn: `EntityDto<TKey>`, `PagedAndSortedResultRequestDto` (mặc định `MaxResultCount` là 10; lớn hơn 1.000 thì lỗi validation), `PagedResultDto<T>`, `ListResultDto<T>`. Best practice còn giới hạn mỗi entity tối đa hai output DTO: bản cơ bản và bản chi tiết.

**Phần gắn với .NET.** Lớp DTO "extensible" (`ExtensibleObject`) phục vụ hệ thống object extension của ABP; không cần. Phần còn lại mang sang nguyên vẹn.

**Tương đương NestJS.** Lớp DTO với `class-validator`/`class-transformer`, hoặc type của GraphQL (`@nestjs/graphql`). Cần phân biệt: DTO của ABP là hợp đồng của **application service**. Trong NestJS, request DTO thường gắn với controller/resolver. Nên để application service nhận input là kiểu TypeScript đơn giản (không decorator HTTP), còn controller/resolver chịu validation; như vậy application service không phụ thuộc tầng web, đúng quy tắc "independent of the web layer" của ABP.

### 3.8 Unit of work

**ABP định nghĩa.** Unit of work (UoW) quản lý kết nối và phạm vi transaction; mọi thao tác trong một UoW cùng commit hoặc cùng rollback ([Unit of Work](https://abp.io/docs/latest/framework/architecture/domain-driven-design/unit-of-work)). Quy ước:

- Action của controller, Razor Page handler, phương thức application service và phương thức repository **tự mở** UoW, trừ khi đã có UoW bao ngoài (ambient); khi đó tham gia UoW ngoài.
- Request HTTP GET mở UoW **không có transaction**; các method HTTP khác mở UoW có transaction. Tùy chỉnh bằng `AbpUnitOfWorkDefaultOptions.TransactionBehavior`.
- `[UnitOfWork]` có `IsTransactional`, `Timeout`, `IsolationLevel`, `IsDisabled`.
- `IUnitOfWorkManager.Begin(requiresNew, ...)` mở UoW thủ công; `requiresNew: true` tách khỏi UoW ngoài.
- Thay đổi được lưu tự động khi UoW kết thúc không lỗi; `SaveChangesAsync()` lưu giữa chừng; exception thì rollback.
- `OnCompleted` đăng ký callback chạy sau khi UoW hoàn tất thành công.

**Domain event so với UoW (điểm khác lớn nhất với khuyến nghị trước).**

- Local event từ aggregate root được phát khi EF Core `SaveChanges`; handler "are always executed in the same unit of work scope", và "If an event handler throws an exception, the unit of work (database transaction) is rolled back" ([Local Event Bus](https://abp.io/docs/latest/framework/infrastructure/event-bus/local)). Tức là handler chạy **trong** transaction, lỗi handler làm hỏng thao tác chính.
- Distributed event mặc định được phát "at the end of the unit of work"; có transactional outbox: event được ghi vào bảng `OutgoingEvents` trong cùng transaction, worker nền gửi đi và thử lại ([Distributed Event Bus](https://abp.io/docs/latest/framework/infrastructure/event-bus/distributed)).

**Phần gắn với .NET/EF Core.**

- UoW tự động dựa trên interception của Castle DynamicProxy: chỉ method async được chặn; service không inject qua interface thì method phải `virtual`.
- Ambient UoW dựa trên `AsyncLocal` của .NET. Node.js tương đương là `AsyncLocalStorage`.
- "Lưu tự động khi UoW kết thúc" dựa trên change tracker của EF Core (mục 3.4). TypeORM không có, nên UoW kiểu NestJS chỉ còn nghĩa "một transaction", không còn nghĩa "tự gom thay đổi".
- Middleware ASP.NET Core commit trước khi response bắt đầu (`CompleteUnitOfWorkOnResponseStarting`); NestJS không có cơ chế này.

**Tương đương NestJS.**

| Gói | Bản mới nhất | Ngày phát hành | Sao GitHub | Commit cuối | Ghi chú |
|---|---|---|---|---|---|
| [`nestjs-cls`](https://github.com/Papooch/nestjs-cls) + [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional) + [`@nestjs-cls/transactional-adapter-typeorm`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/typeorm-adapter) | 7.0.2 / 4.0.2 / 2.0.2 | 2026-10-27 | 713 (repo chung) | 2026-10-27 | Peer dependency: `@nestjs/core` `>= 10 < 13`, `typeorm` `^0.3.2 \|\| ^1.0.0`, khớp với NestJS 12 và typeorm 1.1 của dự án |
| [`typeorm-transactional`](https://github.com/Aliheym/typeorm-transactional) | 0.5.0 | 2023-10-19 | 273 | 2023-10-23 | Không có commit từ hơn ba năm; peer `typeorm >= 0.2.8` không ràng buộc phiên bản 1.x một cách có kiểm chứng |

Số liệu lấy từ npm registry và GitHub API ngày 2026-11-27.

Cách `@nestjs-cls/transactional` hoạt động:

- Lưu transaction đang mở trong CLS (dựa trên `AsyncLocalStorage`), service khác dùng mà không cần truyền tay; "deliberately does not require any monkey-patching".
- `@Transactional()` bọc method trong transaction; `txHost.withTransaction(cb)` là dạng tường minh. Propagation mặc định `Required` (dùng lại transaction đang có, giống ambient UoW của ABP); có `RequiresNew` (giống `requiresNew: true`), `Mandatory`, `Never`, `Supports`, `NotSupported`, `Nested`.
- Với TypeORM, `txHost.tx` có kiểu `EntityManager`. Ràng buộc quan trọng: "the only way to propagate the transaction using this adapter is by using the `EntityManager`" và "There is no transactional support for working directly with repositories" trừ khi lấy từ `EntityManager` của transaction. Nghĩa là repository cài bằng `@InjectRepository(JobOrmEntity)` sẽ **không** tham gia transaction; cài đặt repository phải inject `TransactionHost<TransactionalAdapterTypeOrm>` và gọi `this.txHost.tx.getRepository(JobOrmEntity)`.
- Khi không có transaction đang mở, `txHost.tx` là client thường. Như vậy cùng một repository dùng được cho cả đọc không transaction và ghi trong transaction, giống quy ước GET không transaction của ABP.

Trang adapter TypeORM tự giới thiệu `typeorm-transactional` là giải pháp "more fully featured"; nhưng gói đó đã ngừng phát hành từ 2023-10 và dựa trên việc vá (patch) TypeORM, nên rủi ro hơn với typeorm 1.x.

**Đặt ranh giới transaction ở đâu.** ABP mở UoW cho cả action của controller lẫn application service; khi lồng nhau thì dùng chung. Trong NestJS nên đặt `@Transactional()` trên **phương thức của application service** làm thay đổi dữ liệu, không mở transaction cho mọi request bằng interceptor: truy vấn đọc không cần transaction (như GET của ABP), và application service gọi được từ nơi khác ngoài HTTP (worker BullMQ, job định kỳ) mà vẫn giữ ranh giới.

## 4. Đa tenant: chỗ chạm tới repository và unit of work

**ABP.** Entity cài `IMultiTenant` (chỉ định nghĩa `TenantId`; `null` nghĩa là dữ liệu của host). ABP "automatically sets the TenantId for you when you create a new entity object" từ `ICurrentTenant.Id`, và lọc dữ liệu theo tenant hiện tại khi truy vấn ([Multi-Tenancy](https://abp.io/docs/latest/framework/architecture/multi-tenancy)). Bộ lọc là EF Core global query filter, "works as expected even if you directly work with `DbContext`"; tắt tạm bằng `IDataFilter.Disable<IMultiTenant>()` trong khối `using` ([Data Filtering](https://abp.io/docs/latest/framework/infrastructure/data-filtering)). Tenant hiện tại được lấy từ claim của người dùng trước tiên, rồi đến query string, route, header, cookie. Hệ quả cho repository: điều kiện tenant **ngầm định**, phương thức repository không nhận `tenantId`.

**Hướng dẫn chính thức của NestJS** ([Multi-tenant SaaS](https://docs.nestjs.com/tutorials/multi-tenant-saas)):

- Mọi bảng thuộc tenant có cột `org_id`, và index bắt đầu bằng cột đó.
- Tenant lấy từ tham số route `:orgId`, được `OrganizationGuard` đối chiếu với membership của người dùng; người ngoài nhận 404.
- Lọc **tường minh**: "Put the organization's id in the `WHERE` clause of every query, so an id from another tenant finds nothing." Không có lớp bao repository hay bộ lọc ngầm.
- Hướng dẫn dùng Drizzle ORM, không phải TypeORM.
- Row-level security chỉ được nêu thành một gợi ý, "Consider row-level security as a second line of defense", kèm lưu ý "Superusers bypass it, and so does the owner of a table unless the table forces it". Hướng dẫn không cài đặt RLS.
- Thao tác ghi chạy trong `db.transaction`, bản ghi audit ghi trong cùng transaction, email gửi sau khi commit.

**Khác biệt chạm tới repository/UoW.**

1. **Ngầm định so với tường minh.** ABP lọc ngầm nhờ global query filter. TypeORM không có global filter: tính năng này vẫn là issue mở từ lâu ([typeorm#1601 "Support for scopes/global filters"](https://github.com/typeorm/typeorm/issues/1601)). Vì vậy cách của ABP không chép sang được; cách tường minh của hướng dẫn NestJS, tức là repository nhận `organizationId` (khuyến nghị trước), là cách phù hợp với TypeORM. Đổi lại, quên điều kiện thì lộ dữ liệu, nên cần lớp phòng thủ thứ hai.
2. **Tự gán tenant khi tạo.** ABP tự gán `TenantId`. Ở NestJS, `organizationId` là tham số bắt buộc của `Job.create(...)`, do application service lấy từ phiên đăng nhập; không bao giờ lấy từ dữ liệu client gửi lên.
3. **RLS và unit of work.** RLS của PostgreSQL thường đọc tenant từ biến phiên đặt bằng `SET LOCAL` hoặc `set_config(..., true)`; các biến này chỉ sống trong một transaction. Nếu chọn RLS, **mọi** truy vấn, kể cả đọc, phải chạy trong transaction có đặt biến đó, trái với "đọc không cần transaction" ở mục 3.8. `@nestjs-cls/transactional` làm được việc này (một interceptor hoặc hook mở transaction và đặt biến cho mọi request), nhưng đây là thay đổi ranh giới UoW, nên quyết định trong ADR về multi-tenancy, không quyết ngầm ở đây. (Điều kiện chạy của `SET LOCAL` và `set_config` là kiến thức PostgreSQL chung, tài liệu này chưa đối chiếu nguồn.)
4. **Tắt bộ lọc.** ABP có `IDataFilter.Disable<IMultiTenant>()` cho truy vấn liên tenant (báo cáo của host). Với cách tường minh, truy vấn liên tenant là phương thức repository riêng, tên rõ nghĩa, dễ rà soát hơn một khối `using` tắt bộ lọc.

## 5. So với khuyến nghị trước: theo ABP chỗ nào, không theo chỗ nào

**ABP xác nhận khuyến nghị trước:**

- Repository riêng cho từng aggregate root, interface ở domain, không lộ `IQueryable` (tương ứng: không lộ API TypeORM), không có repository cho entity con. Đây đúng là best practice của ABP, dù cơ chế mặc định của ABP là repository generic.
- Lưu tường minh (`repository.save(job)`). ABP tự yêu cầu gọi `UpdateAsync` tường minh vì không phải database nào cũng theo dõi thay đổi.
- Aggregate có constructor/factory bảo đảm hợp lệ, setter ẩn, thay đổi qua phương thức nghiệp vụ, tham chiếu aggregate khác bằng id.
- Application service nhận/trả DTO, một service cho mỗi aggregate root, không gọi application service khác cùng module.

**Nên điều chỉnh theo ABP:**

1. **Truy vấn hiển thị.** Khuyến nghị trước cho phép application service đọc thẳng qua TypeORM. ABP cấm viết LINQ/SQL trong application service. Nên đặt truy vấn danh sách (lọc, phân trang Job) vào một query repository hoặc query service riêng ở `infrastructure/` có interface, trả thẳng DTO/read model mà không dựng aggregate. Như vậy tầng application không import TypeORM, và vẫn giữ được lợi ích "không dựng aggregate cho truy vấn đọc". Chỗ này lệch có chủ đích khỏi quy tắc "tránh projection" của ABP, vì danh sách Job là màn hình đọc nhiều, cần hiệu năng.
2. **Optimistic concurrency.** Khuyến nghị trước chưa nói. ABP có sẵn `ConcurrencyStamp` trên mọi aggregate root. Hai Declaration Staff đổi trạng thái cùng một Job là tình huống thật, nên thêm `version` vào aggregate và kiểm tra version khi ghi (mục 3.2), vì `save()` của TypeORM không tự làm.
3. **Unit of work.** Khuyến nghị trước nói "mở transaction" nhưng không nói bằng cách nào. Theo ABP: một ranh giới transaction ambient, lồng nhau thì dùng chung, đặt ở application service. Cài bằng `@nestjs-cls/transactional` + adapter TypeORM; repository dùng `txHost.tx`.
4. **Lỗi nghiệp vụ.** Theo ABP: một lớp exception nghiệp vụ có mã lỗi (tương đương `BusinessException`), để tầng api ánh xạ sang lỗi HTTP/GraphQL và bản địa hóa thông báo tiếng Việt.

**Cố ý không theo ABP:**

1. **Thời điểm phát domain event.** ABP chạy local event handler **trong** transaction, handler lỗi thì rollback thao tác chính. Khuyến nghị trước chọn phát **sau commit**, ngoài transaction, vì handler dự kiến là tác vụ phụ (ghi lịch sử, thông báo) và không nên làm hỏng việc đổi trạng thái. Giữ lựa chọn này. Chuyển sang ngữ nghĩa của ABP chỉ khi một handler phải thay đổi dữ liệu khác một cách nguyên tử: khi đó gọi `emitAsync` bên trong method `@Transactional()` và handler dùng `txHost.tx`. Việc CLS context có được truyền vào listener của `EventEmitter2` hay không **chưa được kiểm chứng**; cần một test trước khi dựa vào nó. Hướng outbox với BullMQ (khuyến nghị trước) tương ứng transactional outbox của ABP cho distributed event.
2. **Repository generic và `CrudAppService`.** Không dựng. Job đổi trạng thái qua phương thức nghiệp vụ, không qua "Update" chung.
3. **`includeDetails`.** Không dùng cho repository ghi; `JobRepository` luôn nạp đủ aggregate.
4. **Lọc tenant ngầm định.** Không chép được với TypeORM (không có global filter); giữ `organizationId` tường minh.
5. **Hạ tầng gắn với .NET:** `virtual`, constructor không tham số cho ORM, `ExtraProperties`, DTO extensible, auto API controller, interception, tự lưu thay đổi khi kết thúc UoW.

## 6. Bảng khuyến nghị

| Khối xây dựng | Cách của ABP | Áp dụng cho NestJS | Lý do |
|---|---|---|---|
| Entity | `Entity<TKey>`, constructor bảo đảm hợp lệ, setter ẩn, Id truyền vào (`IGuidGenerator`), `virtual`, constructor rỗng cho ORM | **Điều chỉnh** | Giữ quy tắc thiết kế (hợp lệ ngay khi tạo, Id truyền vào, thay đổi qua phương thức); bỏ `virtual` và constructor rỗng vì chỉ phục vụ EF Core |
| Aggregate root | `AggregateRoot<TKey>`, tham chiếu bằng id, sửa entity con qua root, giữ nhỏ, `ConcurrencyStamp`, `AddLocalEvent` | **Điều chỉnh** | Giữ mọi quy tắc ranh giới (xác nhận Customs Declaration là con của Job); thêm `version` và tự kiểm tra khi ghi vì `save()` của TypeORM không kiểm tra; bỏ `ExtraProperties` |
| Value object | `ValueObject`, `GetAtomicValues()`, so sánh theo giá trị, bất biến | **Áp dụng** | Thuần thiết kế, không phụ thuộc .NET; chỉ dùng cho khái niệm có quy tắc riêng |
| Repository | Generic `IRepository` lộ `IQueryable`, nhưng best practice: interface riêng cho mỗi aggregate root ở domain, không `IQueryable`, không repository cho entity con, `includeDetails` | **Điều chỉnh** | Theo best practice, không theo cơ chế generic; `IQueryable` và change tracking không có trong TypeORM; repository ghi luôn nạp đủ aggregate; cài đặt dùng `txHost.tx` để tham gia transaction |
| Domain service | `DomainService`, hậu tố `Manager`, stateless, nhận domain object, không DTO, không đọc người dùng hiện tại, ném `BusinessException` | **Áp dụng khi cần** | Chưa cần ở MVP vì quy tắc đóng Job nằm trong `Job.close()`; dùng đúng mẫu này nếu tách Customs Declaration thành aggregate riêng |
| Application service | `ApplicationService`, nhận/trả DTO, một service mỗi aggregate root, không LINQ/SQL, gọi `UpdateAsync` tường minh, auto API controller, `CrudAppService` | **Điều chỉnh** | Giữ quy tắc thiết kế; đưa truy vấn đọc vào query repository/service riêng; controller/resolver viết tay; không dùng CRUD chung |
| DTO | Không kế thừa/tham chiếu entity, không logic, không dùng lại input DTO, `PagedResultDto`, giới hạn kích thước trang | **Áp dụng** | Thuần thiết kế; validation đặt ở controller/resolver (`class-validator`), application service nhận kiểu đơn giản; bỏ DTO extensible |
| Unit of work | Tự động theo quy ước (controller, app service, repository), ambient, GET không transaction, tự lưu thay đổi khi kết thúc | **Điều chỉnh** | Dùng `@nestjs-cls/transactional` + adapter TypeORM (được bảo trì, hỗ trợ NestJS 12 và typeorm 1.x), `@Transactional()` trên method ghi của application service; không có "tự lưu" vì TypeORM không có change tracker; không dùng `typeorm-transactional` (ngừng từ 2023) |
| Domain event | Local event chạy trong UoW, lỗi handler thì rollback; distributed event cuối UoW hoặc qua outbox | **Bỏ qua (giữ cách cũ)** | Giữ phát sau commit bằng `@nestjs/event-emitter`, outbox BullMQ sau; chỉ chuyển sang chạy trong transaction khi có handler cần nguyên tử, sau khi kiểm chứng CLS truyền vào listener |
| Đa tenant | `IMultiTenant`, tự gán `TenantId`, global query filter ngầm, `IDataFilter.Disable` | **Bỏ qua** | TypeORM không có global filter; theo hướng dẫn NestJS: `organizationId` tường minh trong mọi truy vấn; RLS là lớp thứ hai nhưng kéo mọi truy vấn vào transaction, cần ADR riêng |

## 7. Nguồn đã đọc

**ABP Framework** (tài liệu `latest`, đọc ngày 2026-11-27; repo [`abpframework/abp`](https://github.com/abpframework/abp) 14.472 sao, cập nhật 2026-11-26):

- [Domain Driven Design](https://abp.io/docs/latest/framework/architecture/domain-driven-design)
- [Entities](https://abp.io/docs/latest/framework/architecture/domain-driven-design/entities), [Entities best practices](https://abp.io/docs/latest/framework/architecture/best-practices/entities)
- [Value Objects](https://abp.io/docs/latest/framework/architecture/domain-driven-design/value-objects)
- [Repositories](https://abp.io/docs/latest/framework/architecture/domain-driven-design/repositories), [Repositories best practices](https://abp.io/docs/latest/framework/architecture/best-practices/repositories)
- [Domain Services](https://abp.io/docs/latest/framework/architecture/domain-driven-design/domain-services), [Domain Services best practices](https://abp.io/docs/latest/framework/architecture/best-practices/domain-services)
- [Application Services](https://abp.io/docs/latest/framework/architecture/domain-driven-design/application-services), [Application Services best practices](https://abp.io/docs/latest/framework/architecture/best-practices/application-services)
- [Data Transfer Objects](https://abp.io/docs/latest/framework/architecture/domain-driven-design/data-transfer-objects)
- [Unit of Work](https://abp.io/docs/latest/framework/architecture/domain-driven-design/unit-of-work)
- [Local Event Bus](https://abp.io/docs/latest/framework/infrastructure/event-bus/local), [Distributed Event Bus](https://abp.io/docs/latest/framework/infrastructure/event-bus/distributed)
- [Multi-Tenancy](https://abp.io/docs/latest/framework/architecture/multi-tenancy), [Data Filtering](https://abp.io/docs/latest/framework/infrastructure/data-filtering)
- [Entity Framework Core integration](https://abp.io/docs/latest/framework/data/entity-framework-core)

**NestJS và TypeORM:**

- [NestJS: Multi-tenant SaaS tutorial](https://docs.nestjs.com/tutorials/multi-tenant-saas)
- [`nestjs-cls` transactional plugin](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional), [TypeORM adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/typeorm-adapter); repo [`Papooch/nestjs-cls`](https://github.com/Papooch/nestjs-cls)
- [`Aliheym/typeorm-transactional`](https://github.com/Aliheym/typeorm-transactional)
- [TypeORM: Repository API](https://typeorm.io/docs/working-with-entity-manager/repository-api), [TypeORM: Entities](https://typeorm.io/docs/entity/entities)
- [TypeORM `SelectQueryBuilder.ts` @ `b1e211f`](https://github.com/typeorm/typeorm/blob/b1e211fc2654d412612a08f8a7fb890f3352614f/packages/typeorm/src/query-builder/SelectQueryBuilder.ts), [typeorm#1601](https://github.com/typeorm/typeorm/issues/1601)
- npm registry (`registry.npmjs.org`) cho phiên bản và ngày phát hành của `nestjs-cls`, `@nestjs-cls/transactional`, `@nestjs-cls/transactional-adapter-typeorm`, `typeorm-transactional`, `typeorm`, `@nestjs/typeorm`, `@nestjs/event-emitter`
