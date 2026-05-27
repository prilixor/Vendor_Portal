using FastEndpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using System.Net;
using System.Net.Http.Json;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class GetIndianStatesEndpoint(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    : EndpointWithoutRequest<Results<Ok<List<StateLookupResponse>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("locations/states");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<StateLookupResponse>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var apiKey = configuration["CountryStateCity:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return TypedResults.Problem(
                title: "Location service not configured",
                detail: "Missing CountryStateCity API key in server configuration.",
                statusCode: StatusCodes.Status500InternalServerError);
        }

        using var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(System.Net.Http.HttpMethod.Get, "https://api.countrystatecity.in/v1/countries/IN/states");
        request.Headers.Add("X-CSCAPI-KEY", apiKey);

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            return TypedResults.Problem(
                title: "Failed to fetch states",
                detail: $"CountryStateCity API returned {(int)response.StatusCode} ({response.StatusCode}).",
                statusCode: StatusCodes.Status502BadGateway);
        }

        var states = await response.Content.ReadFromJsonAsync<List<CountryStateCityStateDto>>(cancellationToken: ct) ?? [];
        var payload = states
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) && !string.IsNullOrWhiteSpace(x.Iso2))
            .Select(x => new StateLookupResponse(x.Name, x.Iso2))
            .ToList();

        return TypedResults.Ok(payload);
    }
}

public sealed class GetIndianCitiesByStateEndpoint(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    : Endpoint<StateCitiesRequest, Results<Ok<List<CityLookupResponse>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("locations/states/{stateIso2}/cities");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<CityLookupResponse>>, ProblemHttpResult>> ExecuteAsync(StateCitiesRequest req, CancellationToken ct)
    {
        var stateIso2 = (req.StateIso2 ?? string.Empty).Trim().ToUpperInvariant();
        if (stateIso2.Length != 2)
        {
            return TypedResults.Problem(
                title: "Invalid state code",
                detail: "State ISO2 code must be 2 characters.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var apiKey = configuration["CountryStateCity:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return TypedResults.Problem(
                title: "Location service not configured",
                detail: "Missing CountryStateCity API key in server configuration.",
                statusCode: StatusCodes.Status500InternalServerError);
        }

        var url = $"https://api.countrystatecity.in/v1/countries/IN/states/{WebUtility.UrlEncode(stateIso2)}/cities";

        using var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(System.Net.Http.HttpMethod.Get, url);
        request.Headers.Add("X-CSCAPI-KEY", apiKey);

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            return TypedResults.Problem(
                title: "Failed to fetch cities",
                detail: $"CountryStateCity API returned {(int)response.StatusCode} ({response.StatusCode}).",
                statusCode: StatusCodes.Status502BadGateway);
        }

        var cities = await response.Content.ReadFromJsonAsync<List<CountryStateCityCityDto>>(cancellationToken: ct) ?? [];
        var payload = cities
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .Select(x => new CityLookupResponse(x.Name))
            .ToList();

        return TypedResults.Ok(payload);
    }
}

public sealed class StateCitiesRequest
{
    public string StateIso2 { get; set; } = string.Empty;
}

public sealed record StateLookupResponse(string Name, string Iso2);

public sealed record CityLookupResponse(string Name);

internal sealed class CountryStateCityStateDto
{
    public string Name { get; set; } = string.Empty;
    public string Iso2 { get; set; } = string.Empty;
}

internal sealed class CountryStateCityCityDto
{
    public string Name { get; set; } = string.Empty;
}
