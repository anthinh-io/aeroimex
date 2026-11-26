#:sdk Aspire.AppHost.Sdk@17.0.0
#:property TargetFramework=net10.0
#:property AspireUseCliBundle=true
#:property UserSecretsId=1329e0c6-27f3-4870-89c7-2221302029f7
#:package Aspire.Hosting.Docker@17.0.0
#:package Aspire.Hosting.PostgreSQL@17.0.0
#:package Aspire.Hosting.Redis@17.0.0

var builder = DistributedApplication.CreateBuilder(args);

builder.Build().Run();
