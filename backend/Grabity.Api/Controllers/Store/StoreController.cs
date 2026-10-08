using Microsoft.AspNetCore.Mvc;

namespace Grabity.Api.Controllers.Store;

[ApiController]
[Route("api/store")]
public class StoreController(StorefrontService storefront, HomeService home) : ControllerBase
{
    /// <summary>Everything the storefront shell needs: settings, menu and footer links.</summary>
    [HttpGet("bootstrap")]
    public Task<BootstrapDto> Bootstrap(CancellationToken ct) => storefront.GetBootstrapAsync(ct);

    [HttpGet("home")]
    public Task<HomeDto> Home(CancellationToken ct) => home.GetAsync(ct);
}
