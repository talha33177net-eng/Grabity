namespace Grabity.Api.Domain;

/// <summary>Entities with audit timestamps that AppDbContext fills in automatically.</summary>
public interface ITimestamped
{
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}
