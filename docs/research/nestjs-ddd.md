# Khảo sát: các dự án NestJS mã nguồn mở tổ chức code theo Domain-Driven Design

**Ngày khảo sát:** 2026-11-26
**Đối tượng đọc:** Tech Lead backend

## 1. Câu hỏi

Backend của sản phẩm là một ứng dụng NestJS (hiện mới là bộ khung, chỉ có `app.module.ts`). Sản phẩm là SaaS nhiều tenant cho các đại lý hải quan Việt Nam: mỗi **Agency** là một tenant, dữ liệu tách biệt. Miền lõi là **Job** (bộ hồ sơ một lô hàng) chứa một hoặc nhiều **Customs Declaration**; **Declaration Staff** cập nhật trạng thái Job bằng tay.

Tài liệu này trả lời: các dự án NestJS mã nguồn mở được dùng rộng rãi tổ chức code theo DDD ra sao, cụ thể ở ba điểm:

1. Cấu trúc thư mục theo bounded context và theo tầng (domain, application, infrastructure).
2. Cách định nghĩa aggregate, value object và repository.
3. Cách phát (publish) và xử lý domain event.

Cuối tài liệu là khuyến nghị cấu trúc cho giai đoạn MVP.

Mọi nhận định dưới đây lấy từ mã nguồn thật của từng repo, đọc qua GitHub API ngày 2026-11-26. Liên kết trỏ tới commit cố định (permalink) để không bị lệch khi repo thay đổi.

## 2. Các dự án được chọn

| Dự án | Vai trò | Sao (stars) | Commit cuối trên nhánh chính | Đánh giá mức duy trì |
|---|---|---|---|---|
| [`Sairyss/domain-driven-hexagon`](https://github.com/Sairyss/domain-driven-hexagon) | Hướng dẫn DDD + Hexagonal kèm mã mẫu NestJS, phổ biến nhất trong nhóm này | 15.042 | 2024-05-14 | Không còn commit từ ~2,5 năm; nên coi là **tài liệu tham khảo**, không phải mã được bảo trì |
| [`andrea-acampora/nestjs-ddd-devops`](https://github.com/andrea-acampora/nestjs-ddd-devops) | Template NestJS theo DDD + CQRS, dùng MikroORM | 180 | 2025-03-27 (bản phát hành 1.3.0) | Còn hoạt động gần đây, nhưng 180 sao là bằng chứng mỏng về mức độ được dùng rộng |
| Cách chính thức của NestJS: thư viện [`nestjs/cqrs`](https://github.com/nestjs/cqrs), trang hướng dẫn [CQRS recipe](https://docs.nestjs.com/recipes/cqrs) và ví dụ [`kamilmysliwiec/nest-cqrs-example`](https://github.com/kamilmysliwiec/nest-cqrs-example) của tác giả NestJS | Cơ chế aggregate + event chính thức của framework | `nestjs/cqrs`: 948; ví dụ: 543 | Thư viện: 2026-11-26 (bản 12.1.3 ngày 2026-11-13); trang docs: 2026-11-25; ví dụ: 2023-06-22 | Thư viện và docs được bảo trì tích cực; repo ví dụ cũ và **không có persistence thật** (repository trả về dữ liệu cố định) |

Ghi chú: trường `pushed_at` của GitHub cho `andrea-acampora/nestjs-ddd-devops` là 2026-11-26, nhưng đó là do bot hoặc nhánh phụ; commit cuối trên nhánh chính là 2025-03-27. Bảng dùng ngày commit nhánh chính.

Các repo khác tìm thấy (`ecaminero/nestjs-ddd` 276 sao, `CodelyTV/typescript-ddd-example` 1.482 sao nhưng không phải NestJS thuần, nhiều repo cá nhân < 150 sao và không còn cập nhật từ 2020–2024) không được chọn vì ít sao hơn hoặc không dùng NestJS làm khung chính.

## 3. Từng dự án

### 3.1 `Sairyss/domain-driven-hexagon`

Gốc permalink: `https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/`

**Cấu trúc thư mục.** Chia theo module (mỗi module là một khái niệm nghiệp vụ: `user`, `wallet`), bên trong mỗi use case có thư mục riêng (README gọi là _Vertical Slicing_, mục "Modules" và "Folder and File Structure"):

```
src/
  libs/ddd/            # lớp nền: aggregate-root.base.ts, entity.base.ts, value-object.base.ts,
                       #          domain-event.base.ts, repository.port.ts, mapper.interface.ts
  libs/db/sql-repository.base.ts
  modules/user/
    commands/create-user/   # command, service (handler), http/cli/message controller, request dto
    queries/find-users/
    domain/                 # user.entity.ts, user.errors.ts, events/, value-objects/
    database/               # user.repository.port.ts (interface) + user.repository.ts (Slonik)
    dtos/  user.mapper.ts  user.module.ts  user.di-tokens.ts
  modules/wallet/
    application/event-handlers/
    domain/  database/
```

Điểm đáng chú ý: interface repository (`user.repository.port.ts`) nằm trong `database/`, **không** nằm trong `domain/`. Tầng application không có thư mục riêng mà nằm trong `commands/` và `queries/` theo từng use case.

**Aggregate.** `AggregateRoot<Props>` kế thừa `Entity<Props>`; giữ danh sách `_domainEvents`, có `addEvent()`, `clearEvents()` và `publishEvents(logger, eventEmitter)` ([`libs/ddd/aggregate-root.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/aggregate-root.base.ts)). Entity giữ `props` dạng `protected`, chỉ lộ getter cần thiết, có hàm `validate()` kiểm tra bất biến trước khi lưu ([`entity.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/entity.base.ts)). Aggregate được tạo qua factory tĩnh `UserEntity.create()`, hàm này sinh id và thêm `UserCreatedDomainEvent`; thay đổi trạng thái đi qua phương thức nghiệp vụ (`makeAdmin()`, `updateAddress()`), mỗi phương thức tự thêm event ([`modules/user/domain/user.entity.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/domain/user.entity.ts)).

Hạn chế: lớp nền `AggregateRoot` import `EventEmitter2` (từ `@nestjs/event-emitter`) và `RequestContextService`, nên tầng domain phụ thuộc framework.

**Value object.** Có lớp nền `ValueObject<T>` thật sự: kiểm tra rỗng, gọi `validate()` trừu tượng, so sánh cấu trúc qua `equals()`, có `unpack()` ([`value-object.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/value-object.base.ts)). Ví dụ dùng thật: `Address` kiểm tra độ dài `country`, `street`, `postalCode` ([`address.value-object.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/domain/value-objects/address.value-object.ts)).

**Repository.** Interface chung `RepositoryPort<Entity>` (`insert`, `findOneById`, `findAll`, `findAllPaginated`, `delete`, `transaction`) ([`repository.port.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/repository.port.ts)); mỗi module mở rộng thêm, ví dụ `UserRepositoryPort.findOneByEmail()` ([`user.repository.port.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/database/user.repository.port.ts)). Lớp cài đặt kế thừa `SqlRepositoryBase` viết bằng Slonik + Zod, có mapper tách mô hình domain khỏi mô hình lưu trữ ([`sql-repository.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/db/sql-repository.base.ts)). Handler nhận repository qua token DI (`USER_REPOSITORY`).

**Domain event.** Dùng `@nestjs/event-emitter`, không dùng event bus của `@nestjs/cqrs`. Thời điểm phát: **bên trong** phương thức ghi của repository (`writeQuery()`, `delete()`), ngay sau câu lệnh SQL, bằng `eventEmitter.emitAsync(event.constructor.name, event)` có `await`. Command handler bọc lệnh ghi trong `userRepo.transaction(...)` ([`create-user.service.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/commands/create-user/create-user.service.ts)), nên handler của event chạy **trong cùng transaction**: nếu handler lỗi thì cả thao tác bị rollback. Handler nằm ở module khác, đánh dấu `@OnEvent(UserCreatedDomainEvent.name, { async: true, promisify: true })`, ví dụ module `wallet` tạo ví khi có người dùng mới ([`create-wallet-when-user-is-created.domain-event-handler.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/wallet/application/event-handlers/create-wallet-when-user-is-created.domain-event-handler.ts)). Lớp nền `DomainEvent` mang `id`, `aggregateId` và metadata (`correlationId`, `causationId`, `timestamp`, `userId`) ([`domain-event.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/domain-event.base.ts)).

**Tác giả tự cảnh báo về độ phức tạp.** Mục "Recommendations for smaller APIs" trong README nói: chia module/tầng/use case và dùng DI hợp với mọi dự án, nhưng tạo object cho mọi kiểu nguyên thủy, dùng nhiều value object, tách domain model khỏi persistence model trong dự án thiên về dữ liệu, ít logic nghiệp vụ "chỉ làm giải pháp phức tạp thêm và thêm boilerplate" ([README.md, mục "Recommendations for smaller APIs"](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/README.md#recommendations-for-smaller-apis)).

### 3.2 `andrea-acampora/nestjs-ddd-devops`

Gốc permalink: `https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/`

**Cấu trúc thư mục.** Chia theo module (bounded context: `auth`, `user`, `communication`, `health`), bên trong mỗi module chia theo tầng rõ ràng:

```
src/
  libs/ddd/        # value-object.abstract.ts, domain-event.abstract.ts, repository.interface.ts,
                   # mikro-orm-repository.abstract.ts, use-case.interface.ts, mapper.interface.ts
  modules/user/
    api/rest/controller/, api/rest/presentation/{body,dto,params}/
    api/graphql/resolver/, api/graphql/presentation/
    application/command/, application/query/
    application/handler/{command,query}/
    application/use-case/create-user.use-case.ts
    domain/entity/user.entity.ts
    domain/event/created-user.event.ts
    domain/repository/user.repository.interface.ts
    domain/value-object/user-role.enum.ts, user-state.enum.ts
    infrastructure/database/{entity,mapper,repository}/
    user.module.ts  user.tokens.ts
  modules/communication/application/handler/event/created-user.handler.ts
```

Đây là bố cục bốn tầng `api / application / domain / infrastructure` dễ đọc nhất trong các dự án được khảo sát. Interface repository nằm trong `domain/repository/`; cài đặt MikroORM nằm trong `infrastructure/`.

**Aggregate.** `User` kế thừa trực tiếp `AggregateRoot` của `@nestjs/cqrs`; giữ `props` công khai, chỉ có một phương thức `create()` gọi `this.apply(new CreatedUserEvent(this))` ([`domain/entity/user.entity.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/domain/entity/user.entity.ts)). Mô hình khá "mỏng": không có bất biến, không có phương thức nghiệp vụ khác.

**Value object.** Có lớp nền `ValueObject<T>` (đóng băng `props`, so sánh bằng JSON) ([`value-object.abstract.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/libs/ddd/value-object.abstract.ts)), nhưng module `user` không dùng nó: thư mục `domain/value-object/` chỉ chứa hai `enum` (`UserRole`, `UserState`).

**Repository.** Interface riêng cho từng aggregate, đặt tên theo nghiệp vụ (`createUser`, `getUserByEmail`, `checkActiveUserById`, `getAllUsers`) và trả về `Option<User>` của thư viện `effect` ([`user.repository.interface.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/domain/repository/user.repository.interface.ts)). Cài đặt `UserRepositoryImpl` dùng `EntityRepository` của MikroORM và một mapper chuyển giữa entity ORM và aggregate ([`user.repository.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/infrastructure/database/repository/user.repository.ts)); gắn vào module qua token `USER_REPOSITORY` ([`user.module.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/user.module.ts)).

**Domain event.** Dùng event bus của `@nestjs/cqrs`. Luồng: command handler gọi use case; use case gọi `userRepository.createUser()`; **chính repository (tầng infrastructure)** gọi `user.value.create()` để sinh event; sau đó use case gọi `eventPublisher.mergeObjectContext(user)` rồi `user.commit()` ([`create-user.use-case.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/application/use-case/create-user.use-case.ts)). Không có transaction. Handler ở module `communication`, đánh dấu `@EventsHandler(CreatedUserEvent)`, gửi email chào mừng ([`created-user.handler.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/communication/application/handler/event/created-user.handler.ts)).

Hạn chế cần biết: việc sinh event nằm ở infrastructure thay vì trong hành vi của aggregate; payload của `CreatedUserEvent` là **toàn bộ** đối tượng `User`, kể cả mật khẩu đã băm ([`created-user.event.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/domain/event/created-user.event.ts)); và có hai lớp gián tiếp (command handler rồi use case) cho cùng một thao tác.

### 3.3 Cách chính thức của NestJS: `@nestjs/cqrs`

Nguồn: mã thư viện [`nestjs/cqrs` @ `ff51155`](https://github.com/nestjs/cqrs/tree/ff51155e2c68c63af76489788ffb453c7dccf5d7), trang [CQRS recipe trong `nestjs/docs.nestjs.com` @ `dad0da0`](https://github.com/nestjs/docs.nestjs.com/blob/dad0da00bf48c8a8714d1661728fe447adaf1977/content/recipes/cqrs.md), ví dụ [`kamilmysliwiec/nest-cqrs-example` @ `5e920b8`](https://github.com/kamilmysliwiec/nest-cqrs-example/tree/5e920b89fceb39f91c2c533e99a6cc27b6681ad4).

**Cấu trúc thư mục.** Thư viện không áp đặt cấu trúc. Ví dụ chính thức chia theo **loại thành phần CQRS** trong một module, không chia theo tầng DDD:

```
src/heroes/
  commands/{handlers,impl}/   events/{handlers,impl}/   queries/{handlers,impl}/
  models/hero.model.ts        repository/hero.repository.ts
  sagas/heroes.sagas.ts       heroes.controller.ts  heroes.module.ts
```

**Aggregate.** Lớp `AggregateRoot` của thư viện ([`src/aggregate-root.ts`](https://github.com/nestjs/cqrs/blob/ff51155e2c68c63af76489788ffb453c7dccf5d7/src/aggregate-root.ts)) cung cấp `apply(event)` (xếp event vào hàng đợi), `commit()` (phát toàn bộ event đang chờ) và `autoCommit`. Docs mô tả ba cách: kế thừa `AggregateRoot`; dùng mixin `WithAggregateRoot(BaseClass)` khi đã có cây kế thừa riêng; hoặc tự cài interface `IAggregateRoot` để tầng domain **hoàn toàn không phụ thuộc framework** (mục "Flexible Aggregate Roots"). Ví dụ `Hero` chỉ có `killEnemy()` và `addItem()`, mỗi hàm `apply` một event ([`hero.model.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/models/hero.model.ts)).

**Value object.** Thư viện và ví dụ không có khái niệm value object.

**Repository.** Không có interface (port); ví dụ dùng thẳng lớp `HeroRepository` và hàm `findOneById` trả về dữ liệu cố định từ file fixture ([`hero.repository.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/repository/hero.repository.ts)). Trang docs gọi thêm `repository.persist(hero)` nhưng không định nghĩa nó.

**Domain event.** Command handler lấy aggregate từ repository, bọc bằng `publisher.mergeObjectContext(hero)`, gọi phương thức nghiệp vụ rồi `hero.commit()` ([`kill-dragon.handler.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/commands/handlers/kill-dragon.handler.ts); [`event-publisher.ts`](https://github.com/nestjs/cqrs/blob/ff51155e2c68c63af76489788ffb453c7dccf5d7/src/event-publisher.ts)). Handler dùng `@EventsHandler`; quy trình nhiều bước dùng `@Saga()` trên luồng RxJS (`ofType(...)` rồi trả về command mới) ([`heroes.sagas.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/sagas/heroes.sagas.ts)).

Ngữ nghĩa thời điểm theo docs hiện tại: publisher mặc định chạy trong bộ nhớ và **không chờ** handler chạy xong. Từ bản 12.1, `commit()` trả về kết quả của publisher; nếu thay bằng publisher bất đồng bộ (ví dụ ghi vào message broker) thì `await hero.commit()` sẽ chờ và ném lỗi khi thất bại, và có thể truyền transaction qua `hero.commit({ transaction: tx })`. `commit()` xóa hàng đợi event ngay khi giao cho bus nên gọi lại không phát trùng.

## 4. Bảng so sánh

| Tiêu chí | `domain-driven-hexagon` | `nestjs-ddd-devops` | `@nestjs/cqrs` (chính thức) |
|---|---|---|---|
| Chia theo bounded context | Có (`modules/user`, `modules/wallet`) | Có (`modules/user`, `auth`, `communication`) | Một module mỗi khái niệm; không hướng dẫn |
| Chia theo tầng | Theo use case (`commands/<use-case>/`, `queries/`) + `domain/` + `database/` | Rõ bốn tầng: `api/`, `application/`, `domain/`, `infrastructure/` | Theo loại CQRS: `commands/`, `events/`, `queries/`, `sagas/` |
| Lớp nền DDD dùng chung | `libs/ddd`: Entity, AggregateRoot, ValueObject, DomainEvent, RepositoryPort, Mapper | `libs/ddd`: ValueObject, DomainEvent, Repository, UseCase, Mapper | `AggregateRoot`, mixin `WithAggregateRoot`, interface `IAggregateRoot` |
| Aggregate | Lớp nền riêng, props ẩn, factory `create()`, `validate()` bất biến | Kế thừa `AggregateRoot` của `@nestjs/cqrs`, props công khai, gần như không có hành vi | Kế thừa / mixin / tự cài `IAggregateRoot` |
| Tầng domain có phụ thuộc framework không | Có (`EventEmitter2`, request context trong lớp nền) | Có (`@nestjs/cqrs`) | Tùy cách; cách 3 thì không |
| Value object | Lớp nền thật, dùng cho `Address` | Có lớp nền nhưng module chỉ dùng `enum` | Không có |
| Vị trí interface repository | `modules/<m>/database/` | `modules/<m>/domain/repository/` | Không có interface, dùng lớp cụ thể |
| Kiểu repository | Generic `RepositoryPort<T>` + mở rộng theo aggregate | Interface riêng, tên phương thức theo nghiệp vụ | Lớp cụ thể |
| ORM / truy cập DB | Slonik + Zod, mapper domain ↔ persistence | MikroORM, mapper domain ↔ ORM entity | Không có (fixture) |
| Cơ chế phát event | `@nestjs/event-emitter` (`emitAsync`) | Event bus `@nestjs/cqrs` (`mergeObjectContext` + `commit`) | Event bus `@nestjs/cqrs` |
| Thời điểm phát và transaction | Trong lệnh ghi của repository, có `await`, **trong** transaction: handler lỗi thì rollback | Sau khi lưu, không có transaction, không chờ handler | Mặc định không chờ handler; từ 12.1 có thể `await commit({ transaction })` với publisher tùy biến |
| Nơi sinh event | Phương thức nghiệp vụ của aggregate | Repository ở infrastructure gọi `user.create()` | Phương thức nghiệp vụ của aggregate (`apply`) |
| Hỗ trợ multi-tenant | Không | Không | Không |
| Mức "nghi thức" | Cao (tác giả tự khuyên giản lược cho dự án nhỏ) | Trung bình–cao (command handler + use case + mapper cho mỗi thao tác) | Thấp nhất, nhưng thiếu phần domain/repository |

## 5. Khuyến nghị cho MVP

### 5.1 Tóm tắt

Lấy **bố cục module theo bounded context, bên trong chia tầng** như `nestjs-ddd-devops`, **cách mô hình hóa aggregate** (props ẩn, factory, phương thức nghiệp vụ sinh event, `validate()` bất biến) như `domain-driven-hexagon`, và **cắt bớt nghi thức** theo đúng lời khuyên "Recommendations for smaller APIs" của chính `domain-driven-hexagon`:

- Chưa dùng `CommandBus`/`QueryBus`: controller hoặc resolver gọi thẳng một application service. Không tách cả "command handler" lẫn "use case" cho cùng một thao tác.
- Value object chỉ cho khái niệm có quy tắc riêng; còn lại dùng kiểu nguyên thủy hoặc `enum`.
- Phát domain event bằng `@nestjs/event-emitter`, vì gói này **đã có** trong `backend/package.json` (cùng `@nestjs/typeorm`, `typeorm`, `@nestjs/graphql`); `@nestjs/cqrs` chưa được cài.

Lưu ý: **không dự án nào trong ba dự án xử lý multi-tenant.** Phần cô lập dữ liệu theo Agency ở mục 5.4 là đề xuất riêng của tài liệu này, không lấy từ nguồn nào ở trên.

### 5.2 Cấu trúc thư mục đề xuất

```
backend/apps/api/src/
  shared/ddd/
    aggregate-root.ts        # giữ danh sách event, addEvent(), pullEvents(); KHÔNG import NestJS
    domain-event.ts          # id, aggregateId, agencyId, occurredAt
  modules/job/               # bounded context Job
    domain/
      job.aggregate.ts       # Job (aggregate root) chứa danh sách CustomsDeclaration
      customs-declaration.entity.ts
      job-status.ts          # enum + quy tắc chuyển trạng thái
      events/job-status-changed.event.ts
      job.repository.ts      # interface + token DI JOB_REPOSITORY
    application/
      job.service.ts         # use case: tạo Job, thêm Customs Declaration, đổi trạng thái
    infrastructure/
      job.orm-entity.ts, customs-declaration.orm-entity.ts   # TypeORM entity
      typeorm-job.repository.ts
      job.mapper.ts
    api/
      job.controller.ts hoặc job.resolver.ts, dto/
    job.module.ts
```

Lý do: bố cục bốn tầng của `nestjs-ddd-devops` dễ đọc với người mới và đặt interface repository trong `domain/` (đúng tinh thần port/adapter hơn cách đặt trong `database/` của `domain-driven-hexagon`). Thư mục `shared/ddd` chỉ chứa vài chục dòng, viết tay, để tầng domain không phụ thuộc framework, giống cách 3 ("tự cài `IAggregateRoot`") mà docs NestJS mô tả.

### 5.3 Aggregate, value object, repository

- **Job là aggregate root; Customs Declaration là entity con bên trong Job** ở giai đoạn MVP. Mọi thay đổi Customs Declaration đi qua phương thức của Job (ví dụ `job.addDeclaration(...)`, `job.changeStatus(next, byStaffId)`), nên Job đảm bảo được bất biến chung (ví dụ không đóng Job khi còn Customs Declaration chưa hoàn tất), và Job cùng các Customs Declaration của nó được lưu trong một transaction. Đổi lại, sửa một Customs Declaration sẽ tải và lưu cả Job; nếu sau này Customs Declaration có vòng đời riêng phức tạp hoặc tranh chấp ghi đồng thời nhiều, hãy tách thành aggregate riêng, tham chiếu Job bằng id.
- Props của aggregate để `private`/`protected`, chỉ lộ getter cần thiết; tạo mới qua factory tĩnh `Job.create(...)`; có `validate()` cho bất biến (theo `domain-driven-hexagon`).
- **Value object chỉ khi có quy tắc**: ví dụ trạng thái Job (tập giá trị và phép chuyển hợp lệ) hoặc số tờ khai nếu có định dạng cần kiểm tra. Không tạo lớp cho mọi chuỗi/số.
- **Repository theo aggregate, tên phương thức theo nghiệp vụ** (theo `nestjs-ddd-devops`): `findById(agencyId, jobId)`, `save(job)`, `list(agencyId, filter, page)`. Không dựng `RepositoryPort<T>` generic. Cài đặt bằng TypeORM, có mapper chuyển giữa TypeORM entity và aggregate. Truy vấn chỉ để hiển thị (danh sách Job có lọc, phân trang) có thể đọc thẳng qua TypeORM ở application service mà không dựng aggregate.

### 5.4 Cô lập dữ liệu theo Agency (đề xuất riêng)

- `agencyId` là thuộc tính bắt buộc của Job (và của mọi aggregate thuộc một Agency), được gán lúc tạo và không đổi.
- Mọi phương thức đọc của repository nhận `agencyId` làm tham số bắt buộc và luôn thêm điều kiện `agency_id = :agencyId`. Application service lấy `agencyId` từ phiên đăng nhập của Declaration Staff, không bao giờ lấy từ dữ liệu client gửi lên.
- Mỗi domain event mang `agencyId` để handler không xử lý nhầm dữ liệu của Agency khác.
- Các lớp phòng thủ sâu hơn (Row-Level Security của PostgreSQL, schema riêng cho từng Agency) nên được quyết định trong một ADR riêng về multi-tenancy.

### 5.5 Domain event

- Aggregate chỉ **thu thập** event (`addEvent`) trong phương thức nghiệp vụ; tầng domain không import `EventEmitter2`.
- Application service: mở transaction, gọi phương thức nghiệp vụ, `repository.save(job)`, commit transaction; **sau khi commit** mới gọi `job.pullEvents()` và phát từng event bằng `EventEmitter2.emitAsync(...)` có `await`.
- Ngữ nghĩa: handler chạy **sau** khi dữ liệu đã được ghi, **ngoài** transaction; handler lỗi không làm hỏng thao tác chính (ghi log). Nếu tiến trình dừng giữa lúc commit và lúc phát thì event bị mất. Với MVP, các handler dự kiến là tác vụ phụ (ghi lịch sử trạng thái, thông báo cho Declaration Staff), nên chấp nhận được.
- Khác với `domain-driven-hexagon`, cách này không phát event trong transaction. Hãy chuyển sang phát trong transaction (handler dùng chung transaction) chỉ khi một handler phải thay đổi aggregate khác một cách nguyên tử. Hãy chuyển sang mẫu transactional outbox (BullMQ, gói đã có trong dự án, có thể làm worker) khi event không được phép mất.
- Nếu sau này cần CQRS đầy đủ (read model riêng, saga), `@nestjs/cqrs` là lựa chọn chính thức và được bảo trì tích cực; aggregate viết theo cách trên có thể cài `IAggregateRoot` mà không phải viết lại.

### 5.6 Những gì cố ý chưa làm ở MVP

- `CommandBus`/`QueryBus`, saga RxJS.
- Kiểu `Result`/`Option` (`oxide.ts`, `effect`) thay cho exception.
- Domain model tách khỏi persistence model cho những bảng chỉ có CRUD (ví dụ danh mục). Chỉ tách cho aggregate có quy tắc nghiệp vụ như Job.
- Event sourcing, outbox, message broker.

## 6. Nguồn đã đọc

**`Sairyss/domain-driven-hexagon`** @ `5c2d15a` (15.042 sao; commit cuối 2024-05-14):
- [`README.md`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/README.md): các mục Modules, Domain Events, Recommendations for smaller APIs, Folder and File Structure
- [`src/libs/ddd/aggregate-root.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/aggregate-root.base.ts), [`entity.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/entity.base.ts), [`value-object.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/value-object.base.ts), [`domain-event.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/domain-event.base.ts), [`repository.port.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/ddd/repository.port.ts)
- [`src/libs/db/sql-repository.base.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/libs/db/sql-repository.base.ts)
- [`src/modules/user/domain/user.entity.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/domain/user.entity.ts), [`value-objects/address.value-object.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/domain/value-objects/address.value-object.ts), [`database/user.repository.port.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/database/user.repository.port.ts), [`commands/create-user/create-user.service.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/user/commands/create-user/create-user.service.ts)
- [`src/modules/wallet/application/event-handlers/create-wallet-when-user-is-created.domain-event-handler.ts`](https://github.com/Sairyss/domain-driven-hexagon/blob/5c2d15a7e2d69e83dfddf28468ee9f30e02c30de/src/modules/wallet/application/event-handlers/create-wallet-when-user-is-created.domain-event-handler.ts)

**`andrea-acampora/nestjs-ddd-devops`** @ `e8f4f55` (180 sao; commit cuối 2025-03-27):
- [`src/libs/ddd/value-object.abstract.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/libs/ddd/value-object.abstract.ts), [`domain-event.abstract.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/libs/ddd/domain-event.abstract.ts), [`repository.interface.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/libs/ddd/repository.interface.ts), [`mikro-orm-repository.abstract.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/libs/ddd/mikro-orm-repository.abstract.ts)
- [`src/modules/user/domain/entity/user.entity.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/domain/entity/user.entity.ts), [`domain/event/created-user.event.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/domain/event/created-user.event.ts), [`domain/repository/user.repository.interface.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/domain/repository/user.repository.interface.ts)
- [`src/modules/user/application/use-case/create-user.use-case.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/application/use-case/create-user.use-case.ts), [`application/handler/command/create-user.handler.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/application/handler/command/create-user.handler.ts)
- [`src/modules/user/infrastructure/database/repository/user.repository.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/infrastructure/database/repository/user.repository.ts), [`mapper/user.mapper.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/infrastructure/database/mapper/user.mapper.ts), [`user.module.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/user/user.module.ts)
- [`src/modules/communication/application/handler/event/created-user.handler.ts`](https://github.com/andrea-acampora/nestjs-ddd-devops/blob/e8f4f5528c0563a55cb92d4dc90b09d29d78fb9f/src/modules/communication/application/handler/event/created-user.handler.ts)

**Cách chính thức của NestJS**:
- `nestjs/cqrs` @ `ff51155` (948 sao; commit cuối 2026-11-26; bản 12.1.3 ngày 2026-11-13): [`src/aggregate-root.ts`](https://github.com/nestjs/cqrs/blob/ff51155e2c68c63af76489788ffb453c7dccf5d7/src/aggregate-root.ts), [`src/event-publisher.ts`](https://github.com/nestjs/cqrs/blob/ff51155e2c68c63af76489788ffb453c7dccf5d7/src/event-publisher.ts)
- Trang CQRS recipe, `nestjs/docs.nestjs.com` @ `dad0da0` (cập nhật 2026-11-25): [`content/recipes/cqrs.md`](https://github.com/nestjs/docs.nestjs.com/blob/dad0da00bf48c8a8714d1661728fe447adaf1977/content/recipes/cqrs.md), bản trên web: https://docs.nestjs.com/recipes/cqrs
- `kamilmysliwiec/nest-cqrs-example` @ `5e920b8` (543 sao; commit cuối 2023-06-22): [`src/heroes/models/hero.model.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/models/hero.model.ts), [`commands/handlers/kill-dragon.handler.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/commands/handlers/kill-dragon.handler.ts), [`repository/hero.repository.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/repository/hero.repository.ts), [`sagas/heroes.sagas.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/sagas/heroes.sagas.ts), [`heroes.module.ts`](https://github.com/kamilmysliwiec/nest-cqrs-example/blob/5e920b89fceb39f91c2c533e99a6cc27b6681ad4/src/heroes/heroes.module.ts)
