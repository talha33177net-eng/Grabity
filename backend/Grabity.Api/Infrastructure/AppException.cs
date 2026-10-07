using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Grabity.Api.Infrastructure;

/// <summary>An expected failure whose message is safe to show to the user.</summary>
public class AppException(string message, int statusCode = StatusCodes.Status400BadRequest) : Exception(message)
{
    public int StatusCode { get; } = statusCode;

    public static AppException NotFound(string what) => new($"{what} not found.", StatusCodes.Status404NotFound);
    public static AppException Conflict(string message) => new(message, StatusCodes.Status409Conflict);
    public static AppException Forbidden(string message = "You are not allowed to do that.") => new(message, StatusCodes.Status403Forbidden);
}

public sealed class AppExceptionHandler(IProblemDetailsService problemDetails, ILogger<AppExceptionHandler> logger, IHostEnvironment env)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            AppException app => (app.StatusCode, app.Message),
            DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } } =>
                (StatusCodes.Status409Conflict, "A record with the same unique value already exists."),
            DbUpdateException { InnerException: SqlException { Number: 547 } } =>
                (StatusCodes.Status409Conflict, "This record is in use by other data and cannot be changed or removed."),
            BadHttpRequestException bad => (bad.StatusCode, bad.Message),
            OperationCanceledException when ct.IsCancellationRequested => (499, "Request cancelled."),
            _ => (StatusCodes.Status500InternalServerError, "Something went wrong. Please try again."),
        };

        if (status >= 500)
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", http.Request.Method, http.Request.Path);

        http.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Detail = status >= 500 && env.IsDevelopment() ? exception.ToString() : null,
            },
        });
    }
}
