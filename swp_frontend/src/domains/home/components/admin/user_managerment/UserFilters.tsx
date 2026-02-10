import type { FilterOptions, SortOptions } from "./user.types";
import "./UserFilters.css";

interface UserFiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filters: FilterOptions;
    onFiltersChange: (filters: FilterOptions) => void;
    sortOption: SortOptions;
    onSortChange: (sort: SortOptions) => void;
    onLimitChange?: (limit: number) => void;
    currentLimit?: number;
}

const UserFilters = ({
    searchTerm,
    onSearchChange,
    filters,
    onFiltersChange,
    sortOption,
    onSortChange,
    onLimitChange,
    currentLimit = 10
}: UserFiltersProps) => {
    {/* //Phan search */ }
    return (
        <>
            <div className="users-filters">
                {/* Search Bar */}
                <div className="search-container">
                    <div className="search-icon">🔍</div>
                    <input
                        type="text"
                        placeholder="Search by name, email..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button
                            className="clear-search"
                            onClick={() => onSearchChange('')}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="filter-row">
                    <div className="filter-group">
                        <label>Role:</label>
                        <select
                            value={filters.role}
                            onChange={(e) => onFiltersChange({
                                ...filters,
                                role: e.target.value as FilterOptions['role']
                            })}
                        >
                            <option value="all">All Roles</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                            <option value="ADMIN">Admin</option>
                            <option value="MODERATOR">Moderator</option>
                            <option value="USER">User</option>
                            <option value="GUEST">Guest</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Status:</label>
                        <select
                            value={filters.status}
                            onChange={(e) => onFiltersChange({
                                ...filters,
                                status: e.target.value as FilterOptions['status']
                            })}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="locked">Locked</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Email:</label>
                        <select
                            value={filters.verified}
                            onChange={(e) => onFiltersChange({
                                ...filters,
                                verified: e.target.value as FilterOptions['verified']
                            })}
                        >
                            <option value="all">All</option>
                            <option value="verified">Verified</option>
                            <option value="unverified">Unverified</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Sort by:</label>
                        <select
                            value={sortOption}
                            onChange={(e) => onSortChange(e.target.value as SortOptions)}
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="email-asc">Email (A-Z)</option>
                            <option value="email-desc">Email (Z-A)</option>
                        </select>
                    </div>

                    <div>
                        <div className="filter-group">
                            <label>Show:</label>
                            <select
                                value={currentLimit}
                                onChange={(e) => onLimitChange?.(Number(e.target.value))}
                            >
                                <option value="5">5 per page</option>
                                <option value="10">10 per page</option>
                                <option value="25">25 per page</option>
                                <option value="50">50 per page</option>
                                <option value="100">100 per page</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

        </>

    );
};

export default UserFilters;