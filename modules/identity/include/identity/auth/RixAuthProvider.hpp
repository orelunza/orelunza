/**
 *
 * @file RixAuthProvider.hpp
 * @author Softadastra
 * @brief Rix authentication adapter for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_AUTH_RIX_AUTH_PROVIDER_HPP_INCLUDED
#define ORELUNZA_IDENTITY_AUTH_RIX_AUTH_PROVIDER_HPP_INCLUDED

#include <identity/auth/AuthProvider.hpp>

namespace rixlib::auth
{
  class Auth;
  class AuthError;
  class Session;
  class User;
}

namespace orelunza::identity::auth
{
  /**
   * @brief Adapts rix/auth to the Orelunza authentication provider contract.
   *
   * Rix-specific users, sessions, and errors are converted before crossing
   * the identity module boundary.
   */
  class RixAuthProvider final : public AuthProvider
  {
  public:
    /**
     * @brief Construct the provider from a configured Rix auth service.
     *
     * The supplied auth service must outlive this adapter.
     *
     * @param auth Rix authentication service.
     */
    explicit RixAuthProvider(rixlib::auth::Auth &auth) noexcept;

    /**
     * @brief Register a new account through Rix.
     *
     * @param credentials Registration credentials.
     * @return Created Orelunza account or an identity error.
     */
    [[nodiscard]] AuthProviderResult<domain::Account>
    register_account(
        const RegisterCredentials &credentials) override;

    /**
     * @brief Authenticate an account through Rix.
     *
     * @param credentials Login credentials.
     * @return Orelunza account and session or an identity error.
     */
    [[nodiscard]] AuthProviderResult<ProviderLoginResult>
    login(const LoginCredentials &credentials) override;

    /**
     * @brief Authenticate an existing Rix session.
     *
     * @param session_id Session identifier.
     * @return Orelunza authentication session or an identity error.
     */
    [[nodiscard]] AuthProviderResult<domain::AuthSession>
    authenticate(std::string_view session_id) override;

    /**
     * @brief Revoke a Rix session.
     *
     * @param session_id Session identifier.
     * @return Operation status.
     */
    [[nodiscard]] AuthProviderStatus
    logout(std::string_view session_id) override;

  private:
    [[nodiscard]] static domain::Account to_account(
        const rixlib::auth::User &user);

    [[nodiscard]] static domain::AuthSession to_session(
        const rixlib::auth::Session &session);

    [[nodiscard]] static errors::IdentityError map_error(
        const rixlib::auth::AuthError &error);

    rixlib::auth::Auth *auth_ = nullptr;
  };
} // namespace orelunza::identity::auth

#endif // ORELUNZA_IDENTITY_AUTH_RIX_AUTH_PROVIDER_HPP_INCLUDED
