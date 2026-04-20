using Prilixor.Shared.Models.Filtering;

namespace Prilixor.Shared.Models.Pagination
{
    public class PaginationFilter : BaseFilter
    {
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string[]? OrderBy { get; set; }
        public SortDirection? SortDirection { get; set; }
    }

    public static class PaginationFilterExtensions
    {
        public static bool HasOrderBy(this PaginationFilter filter) =>
            filter.OrderBy?.Any() is true;
    }
}
