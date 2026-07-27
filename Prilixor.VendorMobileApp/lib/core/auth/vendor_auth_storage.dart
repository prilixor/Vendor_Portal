/// Vendor-only secure storage keys (separate from Customer mobile / web on same origin).
class VendorAuthStorage {
  VendorAuthStorage._();

  static const jwtToken = 'vendor_jwt_token';
  static const refreshToken = 'vendor_refresh_token';
}
