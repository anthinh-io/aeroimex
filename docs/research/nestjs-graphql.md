# Khảo sát: xây dựng GraphQL API bằng NestJS

**Ngày khảo sát:** 27/11/2026

## Bối cảnh và câu hỏi

Backend là một monorepo NestJS 12, hiện có một ứng dụng API, dùng TypeORM và PostgreSQL. Keycloak là nhà cung cấp danh tính (tài khoản và đăng nhập). Frontend là một ứng dụng Next.js, và đây là client duy nhất của API.

Hệ thống chia thành hai bounded context:

- **Job Tracking** gồm các aggregate Job, Customs Declaration và Declarant.
- **Organization Management** gồm Organization, Membership và Invitation.

Mỗi context là một thư mục riêng, chia bốn lớp `domain`, `application`, `infrastructure` và `api`. Hai context chỉ gọi nhau qua một facade cho mỗi context; facade nhận và trả về DTO. Thao tác đọc đi qua các query service trả về DTO. Lỗi nghiệp vụ mang một mã lỗi. Ngữ cảnh của từng request (kể cả transaction) được giữ bằng `nestjs-cls`.

Một người có thể có Membership trong nhiều Organization, nên token đăng nhập không đủ để biết request thuộc Organization nào. Vai trò Platform Operator đứng ngoài mọi Organization.

Các màn hình điển hình:

- Danh sách Job có bộ lọc và phân trang. Mỗi dòng hiện tên Declarant và tên người được giao Job (Assignee). Tên Assignee lấy từ facade của Organization Management.
- Trang chi tiết Job.
- Danh sách cảnh báo.

Tài liệu này so sánh cách ba dự án mã nguồn mở xử lý tám vấn đề khi làm GraphQL với NestJS, rồi đưa ra khuyến nghị cho hệ thống này. Cuối tài liệu có phần cân nhắc REST và GraphQL khi client duy nhất là ứng dụng Next.js của chính sản phẩm.

## Các dự án được khảo sát

Số liệu lấy từ GitHub API ngày 27/11/2026. Liên kết mã nguồn trỏ tới commit cố định để không bị lệch khi repo thay đổi.

| Dự án | Là gì | Stars | Bản phát hành gần nhất | Commit được đọc |
|---|---|---|---|---|
| [nestjs/nest](https://github.com/nestjs/nest), các sample GraphQL | Mẫu chính thức của NestJS: `12-graphql-schema-first`, `23-graphql-code-first`, `33-graphql-mercurius` | 77.243 | v12.6.3, 26/11/2026 | [`d9a5460`](https://github.com/nestjs/nest/tree/d9a546092b326e52d36fb57593f8ef29399b98ad/sample) |
| [twentyhq/twenty](https://github.com/twentyhq/twenty) | CRM mã nguồn mở. Backend NestJS, một endpoint GraphQL phục vụ nhiều workspace | 61.546 | v2.64.1, 27/11/2026 | [`f42d68a`](https://github.com/twentyhq/twenty/tree/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server) |
| [vendurehq/vendure](https://github.com/vendurehq/vendure) | Nền tảng thương mại điện tử headless trên NestJS, hai API GraphQL (Shop, Admin), nhiều Channel | 8.624 | v3.8.2, 12/11/2026 | [`1719d63`](https://github.com/vendurehq/vendure/tree/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src) |

Cả ba đều có commit trong ngày khảo sát. Thư viện tích hợp [nestjs/graphql](https://github.com/nestjs/graphql) (gói `@nestjs/graphql`, `@nestjs/apollo`, `@nestjs/mercurius`) phát hành v14.2.2 ngày 26/11/2026.

Ngoài mã nguồn, tài liệu này dựa trên:

- tài liệu NestJS: [GraphQL quick start](https://docs.nestjs.com/graphql/quick-start), [Other features](https://docs.nestjs.com/graphql/other-features), [Complexity](https://docs.nestjs.com/graphql/complexity), [Authentication](https://docs.nestjs.com/security/authentication), và hướng dẫn [Multi-tenant SaaS](https://docs.nestjs.com/tutorials/multi-tenant-saas);
- tài liệu [nestjs-cls](https://papooch.github.io/nestjs-cls/considerations/compatibility), [Keycloak](https://www.keycloak.org/securing-apps/oidc-layers) và [GraphQL Code Generator](https://the-guild.dev/graphql/codegen/plugins/presets/preset-client).

Hướng dẫn Multi-tenant SaaS của NestJS không làm GraphQL; nó được dùng ở đây vì cách xác định và kiểm tra Organization.

## 1. Driver và kiểu khai báo schema

**NestJS.** Tài liệu quick start nói NestJS có tích hợp chính thức cho hai driver: Apollo (`@nestjs/apollo`), mặc định cho Express và Fastify, và Mercurius (`@nestjs/mercurius`), chỉ chạy trên Fastify. Yoga chỉ được nhắc tới như một tích hợp của bên thứ ba. Cách cài cho Express là `npm i @nestjs/graphql @nestjs/apollo @apollo/server @as-integrations/express5 graphql`. Tài liệu cũng lưu ý `@nestjs/apollo` v14 yêu cầu Apollo Server v5.

Về kiểu schema, tài liệu mô tả hai cách:

- **Code-first:** dùng decorator và class TypeScript để sinh schema.
- **Schema-first:** viết schema bằng SDL, rồi sinh type TypeScript từ đó.

Tài liệu không khuyên cách nào ("Choose the one that suits you best"). Các sample chính thức có đủ cả hai:

- [`23-graphql-code-first`](https://github.com/nestjs/nest/blob/d9a546092b326e52d36fb57593f8ef29399b98ad/sample/23-graphql-code-first/src/app.module.ts): `ApolloDriver` với `autoSchemaFile: 'schema.gql'`.
- [`12-graphql-schema-first`](https://github.com/nestjs/nest/blob/d9a546092b326e52d36fb57593f8ef29399b98ad/sample/12-graphql-schema-first/src/app.module.ts): Apollo với `typePaths: ['./**/*.graphql']`.
- [`33-graphql-mercurius`](https://github.com/nestjs/nest/blob/d9a546092b326e52d36fb57593f8ef29399b98ad/sample/33-graphql-mercurius/src/app.module.ts): `MercuriusDriver`, code-first.

**Twenty** dùng code-first (`autoSchemaFile: true`) nhưng chạy trên driver Yoga (`@graphql-yoga/nestjs`), tức tích hợp bên thứ ba ([`GraphQLConfigService`](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/api/graphql/graphql-config/graphql-config.service.ts)). Nhờ Yoga, Twenty viết giới hạn độ phức tạp và xử lý lỗi dưới dạng plugin của Envelop/Yoga.

**Vendure** dùng `ApolloDriver` và schema-first ([`configure-graphql-module.ts`](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/api/config/configure-graphql-module.ts#L37-L38)). Lý do: Vendure ghép schema lúc chạy từ các file `.graphql`, custom field và phần mở rộng của plugin, rồi truyền vào `typeDefs`. Đây là nhu cầu của một nền tảng có plugin, không phải của một ứng dụng thông thường.

**Ý nghĩa với hệ thống này.** Backend đã chạy trên `@nestjs/platform-express` và đã khai báo `@nestjs/apollo`, `@apollo/server`, `@as-integrations/express5` và `graphql` 17. Chọn Mercurius đồng nghĩa với đổi sang Fastify. Chọn Yoga đồng nghĩa với phụ thuộc vào tích hợp không chính thức.

Code-first hợp với kiến trúc hiện tại. Các DTO mà query service trả về có thể được bọc bởi `@ObjectType` ở lớp `api` mà không chạm tới `domain`. Schema vẫn được ghi ra file nhờ `autoSchemaFile`, và file đó phục vụ sinh type cho frontend (mục 8).

## 2. Tránh N+1 bằng DataLoader

**NestJS.** Tài liệu NestJS không có trang riêng về DataLoader. Sample schema-first có `CatOwnerResolver` dùng `@ResolveField()` gọi `ownersService.findOneById(cat.ownerId)` cho từng con mèo ([nguồn](https://github.com/nestjs/nest/blob/d9a546092b326e52d36fb57593f8ef29399b98ad/sample/12-graphql-schema-first/src/cats/cat-owner.resolver.ts)). Đây chính là mẫu N+1 điển hình: danh sách N phần tử sinh N truy vấn.

**Twenty** tạo toàn bộ loader mỗi request trong `context` factory của module GraphQL:

```ts
context: () => ({
  loaders: this.dataloaderService.createLoaders(),
}),
```

Hàm factory chạy một lần cho mỗi request, nên loader sống theo request mà không cần `Scope.REQUEST`. `DataloaderService` là singleton, và hàm `createLoaders()` dựng khoảng hai mươi `DataLoader` ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/dataloaders/dataloader.service.ts#L206)). Payload của các loader quan hệ mang `workspaceId`, nên mỗi lô truy vấn luôn bị giới hạn trong một workspace.

**Vendure** không đưa loader vào context. Nó tạo loader lười trong resolver và cache theo `RequestContext` bằng `requestContextCache.get(ctx, key, () => new DataLoader(...))` ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/api/resolvers/entity/collection-entity.resolver.ts#L102-L117)). Hàm batch gọi service với mảng id (`getProductVariantCounts(ctx, unique([...ids]))`), rồi trả kết quả đúng thứ tự `ids`. Vendure bật `{ cache: false }` và giải thích: tắt memo để một thao tác ghi xảy ra trước đó trong cùng request không bị kết quả cũ che mất.

**Dữ liệu từ bounded context khác qua facade.** Không dự án nào trong ba dự án có ranh giới bounded context với facade như hệ thống này. Phần sau là suy ra từ cách họ dựng loader:

- **Facade cần một phương thức theo lô.** Tên Assignee trên danh sách Job cần một phương thức nhận mảng id và trả map, ví dụ `findMembersByIds(organizationId, memberIds)` trả DTO. Loader của Job Tracking gọi phương thức này. Nếu facade chỉ có `findMemberById`, DataLoader vẫn gom được lời gọi nhưng vẫn phát N truy vấn bên trong.
- **Loader phải gắn với Organization.** Như Twenty, mỗi lô chỉ thuộc về Organization của request. Hàm batch đọc `organizationId` từ CLS, không nhận nó từ client.
- **Loader nằm ở lớp `api`.** Facade và query service không biết tới DataLoader; loader chỉ là adapter của GraphQL. Như vậy REST, job nền và test vẫn gọi facade bình thường.
- **Danh sách Job có thể không cần loader.** Tên Declarant thuộc cùng context Job Tracking, nên query service của danh sách Job có thể join và trả sẵn tên. DataLoader chỉ thật sự cần cho dữ liệu đi qua facade, tức tên Assignee.

**Đặt loader ở đâu: context GraphQL hay CLS.** Tài liệu `nestjs-cls` nói với `@nestjs/graphql` từ bản 10 trở lên, cách ưu tiên là `ClsMiddleware` với `mount: true` ([nguồn](https://papooch.github.io/nestjs-cls/considerations/compatibility)). Nếu dùng guard hoặc interceptor, enhancer có thể chạy nhiều lần trong một request GraphQL, nên mọi thao tác ghi vào CLS trong enhancer phải idempotent; tài liệu khuyên dùng `ClsService#setIfUndefined()`. Tài liệu không nói gì về DataLoader hay field resolver.

Có hai cách đều chạy được:

- Đặt loader trong context GraphQL như Twenty. Đây là cách phổ biến, và loader tự hết hạn cùng request.
- Đặt loader trong CLS. Cách này đồng nhất với nơi đang giữ transaction.

## 3. Xác thực và phân quyền trong resolver

**Guard với `GqlExecutionContext`.** Tài liệu NestJS ([Other features](https://docs.nestjs.com/graphql/other-features)) nói guard dùng cho GraphQL giống như cho REST, chỉ cần chuyển ngữ cảnh: `GqlExecutionContext.create(context)`. Sau đó dùng `getContext().req` hoặc `getArgs()`. Sample [`cats.guard.ts`](https://github.com/nestjs/nest/blob/d9a546092b326e52d36fb57593f8ef29399b98ad/sample/12-graphql-schema-first/src/cats/cats.guard.ts) chỉ minh hoạ bước chuyển này.

Twenty viết hàm `getRequest()` dùng chung, trả request cho cả `http` lẫn `graphql`, rồi các decorator như `@AuthWorkspace()` đọc `request.workspace` ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/decorators/auth/auth-workspace.decorator.ts)). Vendure có `AuthGuard` toàn cục đọc metadata `@Allow(Permission...)` rồi kiểm tra quyền trên Channel đang hoạt động ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/api/middleware/auth-guard.ts#L49-L90)).

**Guard trên field resolver.** Mặc định NestJS chỉ chạy enhancer trên `@Query()` và `@Mutation()`, không chạy trên `@ResolveField()`. Muốn chạy cả trên field resolver thì đặt `fieldResolverEnhancers: ['guards', 'interceptors', 'filters']`. Tài liệu cảnh báo cách này có thể gây vấn đề hiệu năng.

Twenty bật `['guards', 'filters']` ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/api/graphql/graphql-config/constants/graphql-field-resolver-enhancers.constant.ts)). Tài liệu `@nestjs/authentication` cũng hướng dẫn thêm `fieldResolverEnhancers: ['guards', 'interceptors']` nếu muốn bảo vệ field resolver. Cùng tài liệu đó nói option `context` phải là một hàm dựng context cho mỗi request, vì guard đọc header từ `req` trong context.

**Kiểm tra JWT do Keycloak cấp.** Cả ba dự án đều không kiểm tra trực tiếp token của Keycloak:

- **Twenty** tự phát JWT của mình và kiểm tra trong `JwtAuthStrategy` ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/core-modules/auth/strategies/jwt.auth.strategy.ts#L110-L210)).
- **Vendure** có `AuthenticationStrategy` cho Keycloak: client gửi token Keycloak qua mutation `authenticate`, strategy gọi endpoint userinfo của Keycloak, tìm hoặc tạo Administrator, rồi Vendure dùng session của chính nó ([nguồn](https://docs.vendure.io/guides/core-concepts/auth/)).

Vì vậy cách làm cho hệ thống này dựa trên tài liệu gốc:

- **Keycloak** khuyên kiểm tra access token tại chỗ bằng public key của realm: lấy và cache key theo `kid` từ endpoint `/realms/{realm-name}/protocol/openid-connect/certs`. Gọi introspection thì tốn một lượt mạng mỗi request và có thể làm quá tải Keycloak ([nguồn](https://www.keycloak.org/securing-apps/oidc-layers)).
- **Audience.** Keycloak khuyên các service kiểm tra claim `aud` và giới hạn audience trong token. Muốn `aud` chứa client id của API, cần cấu hình một client scope có audience mapper trong Keycloak ([Server Administration Guide, mục Audience support](https://www.keycloak.org/docs/latest/server_admin/index.html#audience-support)). Nếu thiếu bước này, kiểm tra `audience` ở backend sẽ từ chối mọi token.
- **`@nestjs/authentication`** là gói xác thực chính thức mới của NestJS, cũng là gói mà hướng dẫn Multi-tenant SaaS dùng. Nó có `JwtBearerProvider` nhận option `jwks` (URL https; mặc định chấp nhận `RS256` và `ES256`), kèm `issuer` và `audience` bắt buộc. `JwksClient` có `cacheTtl` (mặc định `'10m'`), `cooldown` (`'30s'`) và `timeout` (`'5s'`). Guard toàn cục của gói chạy được với resolver GraphQL ([nguồn](https://docs.nestjs.com/security/authentication)). Gói đang ở phiên bản 0.1.8 trên npm, nên API còn có thể đổi.
- **Thay thế:** tự viết guard dùng `createRemoteJWKSet` và `jwtVerify` của thư viện [`jose`](https://github.com/panva/jose) (7.896 stars, đẩy code ngày 26/11/2026). Guard này kiểm tra `iss`, `aud`, `exp`, rồi đưa người dùng vào CLS.

## 4. Xác định Organization hiện tại trên một endpoint GraphQL

Đây là điểm ba dự án khác nhau nhiều nhất.

**Hướng dẫn Multi-tenant SaaS của NestJS (REST)** đặt id Organization trên đường dẫn (`/orgs/:orgId/projects`), còn JWT chỉ xác định người dùng ([nguồn](https://docs.nestjs.com/tutorials/multi-tenant-saas)).

- `OrganizationGuard` kiểm tra `:orgId` là UUID, rồi truy vấn bảng membership theo `orgId` và `user.id`.
- Người không phải thành viên nhận 404, giống như Organization không tồn tại. Thành viên có vai trò thấp hơn mức `@MinRole()` yêu cầu nhận 403.
- Membership được gắn vào request để handler đọc qua `@CurrentMembership()`.
- Hướng dẫn nhấn mạnh hai điều. Thứ nhất, đặt id Organization vào mệnh đề `WHERE` của mọi truy vấn. Thứ hai, cây provider theo Organization chỉ là cache, không phải ranh giới phân quyền ("The tree is a cache, not an authorization boundary").
- Hướng dẫn còn khuyên thêm row-level security của PostgreSQL trên `org_id` làm lớp bảo vệ thứ hai, và đặt giới hạn tần suất theo Organization sau bước kiểm tra membership.

**Vendure** (gần nhất với một endpoint GraphQL dùng chung):

- Client chọn Channel bằng header `vendure-token`. Tên header cấu hình được qua `channelTokenKey`, và cũng đọc được từ query string ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/service/helpers/request-context/request-context.service.ts#L146-L155)).
- Không có token thì dùng Channel mặc định. Token không khớp Channel nào thì ném `ChannelNotFoundError` ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/service/services/channel.service.ts#L270-L295)).
- Quyền gắn với Channel: mỗi Role thuộc một hoặc nhiều Channel, và `getChannelPermissions(user.roles)` gộp quyền theo từng Channel ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/service/helpers/utils/get-user-channels-permissions.ts)).
- `ctx.userHasPermissions(permissions, channelId = this.channelId)` mặc định kiểm tra trên Channel của request ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/api/common/request-context.ts#L306-L312)).

**Twenty** đặt workspace vào chính JWT mà nó tự phát. Mỗi token mang `workspaceId` và `userWorkspaceId`. `JwtAuthStrategy.validateAccessToken` kiểm tra ba điều:

- workspace tồn tại;
- `userWorkspace.workspaceId` khớp workspace trong token;
- người dùng là workspace member, nếu không thì ném `FORBIDDEN_EXCEPTION` "User is not a member of the workspace" ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/core-modules/auth/strategies/jwt.auth.strategy.ts#L110-L210)).

Muốn đổi workspace thì phải lấy token mới. Cách này chỉ khả thi khi ứng dụng tự phát token. Với token của Keycloak, muốn làm theo Twenty thì phải thêm bước đổi token Keycloak lấy token riêng của ứng dụng, đã gắn sẵn một Organization.

**So sánh ba phương án cho hệ thống này:**

| Phương án | Ưu | Nhược |
|---|---|---|
| Header, ví dụ `X-Organization-Id` (như Vendure) | Một chỗ duy nhất. Guard đọc header, kiểm tra Membership, ghi Organization vào CLS. Query service và facade đọc từ CLS như với transaction. Client Next.js đặt header một lần trong lớp gọi API | Header vô hình trong schema, nên phải ghi rõ trong tài liệu API. Request thiếu header phải bị từ chối rõ ràng, trừ thao tác của Platform Operator |
| Argument `organizationId` trên từng query và mutation | Hiện rõ trong schema. Một query có thể đọc nhiều Organization | Phải lặp lại ở mọi field gốc, dễ quên. Phải kiểm tra Membership ở từng resolver hoặc bằng một guard đọc args. Không hợp khi cần một nguồn sự thật duy nhất trong CLS |
| Token riêng của ứng dụng, gắn một Organization (như Twenty) | Organization không thể bị giả trong request. Không cần tra Membership mỗi request nếu tin token | Phải xây dịch vụ đổi token và refresh token bên cạnh Keycloak. Đổi Organization phải xin token mới. Thu hồi Membership chỉ có hiệu lực khi token hết hạn |

**Platform Operator.** Không dự án nào có vai trò nằm ngoài mọi Organization giống hệt. Gần nhất là quyền SuperAdmin của Vendure trên Channel mặc định. Cách đề xuất:

- Nhận diện Platform Operator bằng realm role trong token Keycloak.
- Đưa các thao tác của Platform Operator vào resolver riêng, không cần header Organization, và đánh dấu bằng decorator riêng.
- Guard Organization bỏ qua các resolver này một cách tường minh, không phải vì thiếu header.

## 5. Phân trang

**Twenty** dùng connection kiểu Relay cho mọi đối tượng: `edges { node cursor }`, `pageInfo`, `totalCount`. Phía sau là keyset pagination theo cursor ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/api/graphql/workspace-schema-builder/graphql-type-generators/object-types/connection-gql-object-type.generator.ts)). Cách này hợp với giao diện cuộn vô hạn và với dữ liệu thay đổi liên tục.

**Vendure** dùng offset: interface `PaginatedList { items, totalItems }` với tham số `skip` và `take` ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/api/schema/common/common-types.graphql)).

**Sample của NestJS** dùng `skip`/`take` trong `RecipesArgs`, không có tổng số.

**Ý nghĩa với hệ thống này.** Bảng danh sách Job theo mẫu giao diện quản trị đã chọn có số trang và tổng số dòng. Offset kèm `totalCount` khớp trực tiếp với kiểu bảng đó. Cursor chỉ đáng dùng khi có danh sách cuộn vô hạn hoặc nhiều dòng tới mức `OFFSET` chậm, ví dụ có thể là danh sách cảnh báo.

## 6. Ánh xạ lỗi nghiệp vụ có mã lỗi sang lỗi GraphQL

Có ba tầng.

**Tầng 1: hành vi sẵn có của driver Apollo.** Option `autoTransformHttpErrors` mặc định bật và chuyển `HttpException` thành lỗi GraphQL. Chỉ bốn mã HTTP được ánh xạ ([nguồn](https://github.com/nestjs/graphql/blob/b9d642c1e43ebb087cc598fdba3df0fba88d1dde/packages/apollo/lib/drivers/apollo-base.driver.ts#L82-L87)):

| HTTP | `extensions.code` |
|---|---|
| 400 | `BAD_REQUEST` |
| 422 | `BAD_USER_INPUT` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |

Mọi mã khác, kể cả 404 của `NotFoundException`, ra `INTERNAL_SERVER_ERROR` kèm `status` ([nguồn](https://github.com/nestjs/graphql/blob/b9d642c1e43ebb087cc598fdba3df0fba88d1dde/packages/apollo/lib/drivers/apollo-base.driver.ts#L600-L632)). Vì vậy không nên để lỗi nghiệp vụ đi qua `HttpException`.

**Tầng 2: mã lỗi nghiệp vụ trong `extensions`.**

- **Twenty** có `BaseGraphQLError`. Khi nhận một `CustomException`, nó đặt `extensions.code` là nhóm lỗi chung (`NOT_FOUND`, `FORBIDDEN`, `BAD_USER_INPUT`, ...) và `extensions.subCode` là mã lỗi nghiệp vụ, kèm `userFriendlyMessage` đã dịch ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/core-modules/graphql/utils/graphql-errors.util.ts)). Việc chuyển đổi nằm trong plugin `useGraphQLErrorHandlerHook` và các hàm `...-graphql-api-exception-handler` của từng module.
- **Vendure** cho lỗi kế thừa trực tiếp `GraphQLError` qua `I18nError`, với `extensions: { code }`. Ví dụ `EntityNotFoundError` mang mã `ENTITY_NOT_FOUND` ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/i18n/i18n-error.ts)). Đổi lại, lớp lỗi của Vendure phụ thuộc vào `graphql`.

**Tầng 3: lỗi là một phần của schema.** Với kết quả nghiệp vụ dự kiến được, Vendure trả union `ErrorResult` có `errorCode` và `message` thay vì ném lỗi. Ví dụ `InvalidCredentialsError` và `OrderStateTransitionError` ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/core/src/api/schema/common/common-error-results.graphql)). Client buộc phải xử lý từng nhánh. Đổi lại, schema dài hơn và mỗi mutation phải khai báo union.

**Ý nghĩa với hệ thống này.** Lỗi nghiệp vụ ở lớp `domain` không nên phụ thuộc `graphql`. Một exception filter (`GqlExceptionFilter`) hoặc hàm `formatError` ở lớp `api` đọc mã lỗi của exception và ghi vào `extensions.code`. Mã lỗi chung của framework (`UNAUTHENTICATED`, `FORBIDDEN`) vẫn giữ nguyên. Lỗi không có mã thì bị che thành `INTERNAL_SERVER_ERROR` và ghi log.

## 7. Giới hạn độ phức tạp và độ sâu truy vấn

**Tài liệu và sample NestJS** dùng [`graphql-query-complexity`](https://github.com/slicknode/graphql-query-complexity) qua một Apollo plugin (`@Plugin()`, hook `didResolveOperation`). Plugin dùng `fieldExtensionsEstimator()` và `simpleEstimator({ defaultComplexity: 1 })`, rồi ném lỗi khi vượt ngưỡng. Có thể khai báo `complexity` trên `@Field()`, `@Query()` và `@Mutation()` ([tài liệu](https://docs.nestjs.com/graphql/complexity), [sample](https://github.com/nestjs/nest/blob/d9a546092b326e52d36fb57593f8ef29399b98ad/sample/23-graphql-code-first/src/common/plugins/complexity.plugin.ts)). Bản 2.0.0 trên npm chấp nhận `graphql` `^16.6.0 || ^17.0.0`.

**Vendure** đóng gói `HardenPlugin` ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/packages/harden-plugin/src/harden.plugin.ts)):

- giới hạn `maxQueryComplexity` bằng `graphql-query-complexity`;
- `logComplexityScore` để chỉnh ngưỡng;
- ẩn gợi ý tên field (`hideFieldSuggestions`);
- tắt introspection khi `apiMode` không phải `'dev'`.

**Twenty** tự viết plugin `useValidateGraphqlQueryComplexity`. Plugin đếm số field (`GRAPHQL_MAX_FIELDS`), số root resolver (`GRAPHQL_MAX_ROOT_RESOLVERS`) và độ sâu lồng nhau ngay khi parse, rồi ném `UserInputError` ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-server/src/engine/core-modules/graphql/hooks/use-validate-graphql-query-complexity.hook.ts)).

**Khi chỉ có một client của chính sản phẩm.** Biện pháp mạnh nhất là chỉ chấp nhận các truy vấn đã biết trước (persisted hoặc trusted documents):

- Preset `client-preset` của GraphQL Code Generator có option `persistedDocuments`, sinh file ánh xạ hash sang nội dung truy vấn ([nguồn](https://the-guild.dev/graphql/codegen/plugins/presets/preset-client)).
- Trang tài liệu của Apollo Server tự host chỉ mô tả Automatic Persisted Queries ([nguồn](https://www.apollographql.com/docs/apollo-server/performance/apq)). Đó là cơ chế cache, vẫn nhận truy vấn tuỳ ý. Muốn chặn truy vấn lạ trên Apollo tự host thì phải tự viết plugin tra bảng hash; đây là suy luận từ tài liệu, không phải tính năng có sẵn được ghi trong tài liệu.

## 8. Sinh type TypeScript cho frontend Next.js

**Twenty** dùng `@graphql-codegen/cli` với các plugin `typescript`, `typescript-operations` và `typed-document-node` ([nguồn](https://github.com/twentyhq/twenty/blob/f42d68ad4d484117e5cd0202102bf6b1de73601c/packages/twenty-front/codegen.cjs)). Codegen đọc schema từ server đang chạy (`/graphql`) và đọc truy vấn từ các thư mục `graphql/` của frontend. Kết quả là type cho schema và `TypedDocumentNode` cho từng truy vấn.

**Vendure** dùng `@graphql-codegen/*` cho type chung, và `gql.tada` cho dashboard mới. `gql.tada` suy type trực tiếp từ chuỗi truy vấn mà không cần bước sinh file cho từng truy vấn ([nguồn](https://github.com/vendurehq/vendure/blob/1719d635a5e4fa2e5f58bb8d82d00b06e710f0b7/package.json)).

**GraphQL Code Generator** khuyên dùng `client-preset` ([nguồn](https://the-guild.dev/graphql/codegen/plugins/presets/preset-client)):

- Sinh hàm `graphql()` có type cho từng truy vấn.
- Fragment masking bật mặc định.
- Option `persistedDocuments` nối với mục 7.
- Có SWC plugin cho Next.js để giảm kích thước bundle.
- Bản 7.0.1 và `@graphql-codegen/cli` 8.0.0 đều chấp nhận `graphql` 17.

**Ý nghĩa với hệ thống này.** Với code-first, `autoSchemaFile` ghi schema ra một file trong monorepo. Codegen của frontend đọc thẳng file đó, nên không cần backend đang chạy, và CI phát hiện ngay khi schema đổi làm hỏng truy vấn.

## Khuyến nghị cho hệ thống này

Nếu chọn GraphQL, đề xuất như sau.

1. **Driver và schema:** dùng `@nestjs/apollo` trên Express, code-first với `autoSchemaFile` ghi ra file. Các gói này đã được khai báo trong backend.
2. **DataLoader:**
   - Tạo loader mỗi request, trong `context` factory như Twenty hoặc trong CLS.
   - Mỗi facade cung cấp phương thức theo lô (mảng id, có `organizationId`) cho dữ liệu cần hiển thị trong danh sách, ví dụ tên Assignee.
   - Hàm batch đọc Organization từ CLS.
   - Dữ liệu trong cùng một context (tên Declarant) thì query service join sẵn.
3. **Xác thực:**
   - Kiểm tra JWT của Keycloak tại chỗ bằng JWKS của realm, kiểm tra `iss`, `aud` và `exp`. Cấu hình audience mapper trong Keycloak để `aud` chứa client id của API.
   - Dùng guard tự viết với `jose`. `@nestjs/authentication` (`JwtBearerProvider` với `jwks`) đáng xem lại khi gói ra bản 1.x.
   - Guard chỉ chạy ở query và mutation gốc. Field resolver không mở thêm ranh giới quyền, vì mọi loader đã bị giới hạn theo Organization.
4. **Organization hiện tại:**
   - Header `X-Organization-Id`.
   - Middleware `ClsMiddleware` (`mount: true`) mở CLS. Guard xác minh Membership qua facade Organization Management, ghi Organization và vai trò vào CLS bằng `setIfUndefined()`.
   - Người không phải thành viên nhận lỗi như khi Organization không tồn tại.
   - Mọi truy vấn lọc theo `organization_id`, có thể thêm row-level security.
   - Platform Operator dùng resolver riêng, nhận diện qua realm role.
5. **Phân trang:** offset kèm `totalCount` cho các bảng có số trang (danh sách Job). Chỉ dùng connection theo cursor khi có màn hình cuộn vô hạn.
6. **Lỗi:**
   - Exception filter ở lớp `api` ghi mã lỗi nghiệp vụ vào `extensions.code`.
   - Không dùng `HttpException` cho lỗi nghiệp vụ, vì driver chỉ ánh xạ bốn mã HTTP.
   - Cân nhắc union kiểu `ErrorResult` cho các mutation có kết quả thất bại dự kiến được, nếu giao diện cần hiển thị theo từng loại.
7. **Bảo vệ truy vấn:**
   - Plugin `graphql-query-complexity` theo tài liệu NestJS, có ngưỡng.
   - Tắt introspection ở môi trường production.
   - Về sau có thể bật trusted documents từ `persistedDocuments` của codegen.
8. **Sinh type:** `client-preset` của GraphQL Code Generator đọc file schema do backend sinh. Chạy trong CI để phát hiện truy vấn hỏng khi schema đổi.

### REST hay GraphQL khi client duy nhất là ứng dụng Next.js của sản phẩm

**GraphQL được gì:**

- Một màn hình lấy đúng dữ liệu cần trong một request. Ví dụ danh sách Job kèm tên Declarant và tên Assignee, dù tên Assignee nằm ở context khác.
- Type đầu-cuối nhờ codegen.
- Thêm field không làm hỏng client cũ.
- Các gói GraphQL đã có sẵn trong backend.

**GraphQL tốn gì:**

- Phải tự lo N+1 bằng DataLoader. Facade phải có phương thức theo lô.
- Phải lo giới hạn độ phức tạp, và cẩn thận với guard trên field resolver.
- Phản hồi luôn có HTTP 200 kèm mảng `errors`, nên giám sát và log theo mã HTTP không còn dùng được, phải đọc `extensions.code`.
- Không có cache HTTP theo URL cho truy vấn POST.
- Upload file và tải file thường vẫn cần endpoint REST riêng.
- Đội phải học thêm một mô hình.

**REST làm được gì tương đương:**

- Sinh client có type từ OpenAPI (NestJS có `@nestjs/swagger`).
- Gộp dữ liệu nhiều context cho một màn hình bằng một endpoint dành cho màn hình đó, hoặc gộp trong server component của Next.js.

**Khi nào nên chọn REST:**

- Khi số màn hình ít và mỗi màn hình cần dữ liệu cố định, REST với endpoint theo màn hình đơn giản hơn và dễ giám sát hơn.

**Khi nào nên chọn GraphQL:**

- Khi nhiều màn hình cần những tổ hợp dữ liệu khác nhau từ nhiều context.
- Khi giao diện thay đổi nhanh và đội không muốn thêm endpoint cho mỗi lần đổi.

Với một client duy nhất, lợi thế lớn nhất của GraphQL là cho bên thứ ba truy vấn linh hoạt. Lợi thế đó không có ở đây, nên lựa chọn nên dựa vào số lượng và độ biến động của màn hình, không dựa vào chuyện GraphQL "hiện đại" hơn.

### Bảng tổng hợp

| Vấn đề | Các phương án | Khuyến nghị | Lý do |
|---|---|---|---|
| Driver | `@nestjs/apollo`; `@nestjs/mercurius`; Yoga (bên thứ ba) | `@nestjs/apollo` | Driver mặc định cho Express, có tích hợp chính thức. Backend đã chạy Express và đã có các gói Apollo. Mercurius buộc đổi sang Fastify |
| Kiểu schema | Code-first; schema-first | Code-first, `autoSchemaFile` ghi ra file | Mọi thứ ở trong TypeScript. DTO ở lớp `api` được bọc bằng decorator mà không chạm `domain`. Schema-first chỉ đáng khi ghép schema lúc chạy như Vendure |
| N+1 | Gọi facade từng phần tử; DataLoader trong context GraphQL; DataLoader trong CLS | DataLoader tạo mỗi request, gọi phương thức theo lô của facade, giới hạn theo Organization | Twenty và Vendure đều tạo loader theo request. Facade theo lô mới thật sự gom truy vấn qua ranh giới context |
| Kiểm tra JWT Keycloak | `jose` với JWKS; `@nestjs/authentication` (`JwtBearerProvider`, `jwks`); introspection | Guard tự viết dùng `jose` với JWKS của realm, kiểm tra `iss`, `aud`, `exp` | Keycloak khuyên kiểm tra tại chỗ. `jose` ổn định. `@nestjs/authentication` mới ở bản 0.1.8. Introspection tốn một lượt mạng mỗi request |
| Phân quyền trong resolver | Guard chỉ ở root; `fieldResolverEnhancers` cho field | Guard ở root, loader giới hạn theo Organization | Tài liệu NestJS cảnh báo hiệu năng khi bật enhancer cho field. Field resolver ở đây không mở ranh giới quyền mới |
| Organization hiện tại | Header (Vendure); argument trên mỗi field; token riêng gắn Organization (Twenty); đường dẫn (hướng dẫn REST của NestJS) | Header `X-Organization-Id`, guard xác minh Membership, ghi vào CLS | Một chỗ duy nhất, khớp CLS đang giữ transaction. Token Keycloak không mang Organization, mà token riêng thì phải xây thêm dịch vụ đổi token |
| Platform Operator | Chung đường với Organization; resolver riêng | Resolver riêng, nhận diện qua realm role | Vai trò này đứng ngoài mọi Organization, nên guard bỏ qua phải là quyết định tường minh |
| Phân trang | Offset kèm tổng (Vendure); connection kiểu Relay (Twenty) | Offset kèm `totalCount`; cursor chỉ cho màn hình cuộn vô hạn | Bảng quản trị có số trang và tổng số dòng |
| Lỗi nghiệp vụ | `HttpException`; mã lỗi trong `extensions` (Twenty, Vendure); union `ErrorResult` (Vendure) | Filter ở lớp `api` ghi mã lỗi nghiệp vụ vào `extensions.code`; union chỉ khi giao diện cần | Driver chỉ ánh xạ bốn mã HTTP, còn 404 thành `INTERNAL_SERVER_ERROR`. Domain không nên phụ thuộc `graphql` |
| Độ phức tạp, độ sâu | `graphql-query-complexity`; plugin tự đếm field và độ sâu (Twenty); trusted documents | `graphql-query-complexity` kèm tắt introspection ở production; trusted documents về sau | Cách tài liệu NestJS hướng dẫn, hỗ trợ `graphql` 17. Trusted documents là lớp bảo vệ mạnh nhất khi chỉ có một client |
| Sinh type cho frontend | `client-preset`; plugin `typescript-operations` và `typed-document-node` (Twenty); `gql.tada` (Vendure) | `client-preset` đọc file schema do backend sinh | Preset được GraphQL Code Generator khuyên dùng, hỗ trợ Next.js và `persistedDocuments`, không cần server đang chạy |
| REST hay GraphQL | REST với OpenAPI; GraphQL | Quyết định theo số lượng và độ biến động của màn hình | Không có client bên thứ ba, nên lợi thế lớn nhất của GraphQL không áp dụng. Chi phí vận hành của GraphQL là có thật |
