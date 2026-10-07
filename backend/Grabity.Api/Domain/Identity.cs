using Microsoft.AspNetCore.Identity;

namespace Grabity.Api.Domain;

public class AppUser : IdentityUser<int>
{
    public string FullName { get; set; } = "";
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class AppRole : IdentityRole<int>
{
    public AppRole() { }
    public AppRole(string name) : base(name) { }
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string Manager = "Manager";
    public const string Customer = "Customer";

    /// <summary>Anyone allowed into the admin panel.</summary>
    public const string Staff = Admin + "," + Manager;

    public static readonly string[] All = [Admin, Manager, Customer];
}
