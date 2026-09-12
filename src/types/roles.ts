export type UserRole = "manufacturer" | "retailer" | "recycler" | "logistics";

export function isLogisticsRole(role: string): boolean {
  return role === "logistics";
}

export function isBusinessRole(role: string): boolean {
  return role === "manufacturer" || role === "retailer" || role === "recycler";
}
