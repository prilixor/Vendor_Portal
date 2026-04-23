# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /app

COPY . ./

RUN dotnet restore Prilixor.VendorPortal.sln
RUN dotnet publish Prilixor.VendorPortal.API/Prilixor.VendorPortal.API.csproj -c Release -o out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview
WORKDIR /app

COPY --from=build /app/out .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}

ENTRYPOINT ["dotnet", "Prilixor.VendorPortal.API.dll"]