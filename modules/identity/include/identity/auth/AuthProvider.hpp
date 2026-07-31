/**
 *
 * @file AuthProvider.hpp
 * @author Softadastra
 * @brief Authentication provider abstraction for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_AUTH_AUTH_PROVIDER_HPP_INCLUDED
#define ORELUNZA_IDENTITY_AUTH_AUTH_PROVIDER_HPP_INCLUDED

#include <identity/domain/Account.hpp>
#include <identity/domain/AuthSession.hpp>
#include <identity/errors/IdentityError.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::identity::auth
{
  /**
   * @brief Result returned by authentication provider operations.
   *
   * @tparam T Successful result value type.
   */
  template <typename T>
  class AuthProviderResult
  {
  public:
    /**
     * @brief Create a successful provider result.
     *
     * @param value Successful result value.
     * @return Successful provider result.
     */
    [[nodiscard]] static AuthProviderResult success(T value)
    {
      return AuthProviderResult{std::move(value)};
    }

    /**
     * @brief Create a failed provider result.
     *
     * @param error Identity error.
     * @return Failed provider result.
     */
    [[nodiscard]] static AuthProviderResult failure(
        errors::IdentityError error)
    {
      return AuthProviderResult{std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when a value is available.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return value_.has_value() && error_.ok();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when the operation failed.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the successful value.
     *
     * The caller must verify that the operation succeeded first.
     *
     * @return Successful result value.
     */
    [[nodiscard]] T &value() &
    {
      return *value_;
    }

    /**
     * @brief Return the successful value.
     *
     * The caller must verify that the operation succeeded first.
     *
     * @return Successful result value.
     */
    [[nodiscard]] const T &value() const &
    {
      return *value_;
    }

    /**
     * @brief Move the successful value out of the result.
     *
     * The caller must verify that the operation succeeded first.
     *
     * @return Successful result value.
     */
    [[nodiscard]] T &&value() &&
    {
      return std::move(*value_);
    }

    /**
     * @brief Return the operation error.
     *
     * @return Identity error.
     */
    [[nodiscard]] const errors::IdentityError &error() const noexcept
    {
      return error_;
    }

  private:
    explicit AuthProviderResult(T value)
        : value_(std::move(value))
    {
    }

    explicit AuthProviderResult(errors::IdentityError error)
        : error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::IdentityError error_;
  };

  /**
   * @brief Status returned by provider operations without a value.
   */
  class AuthProviderStatus
  {
  public:
    /**
     * @brief Create a successful provider status.
     *
     * @return Successful provider status.
     */
    [[nodiscard]] static AuthProviderStatus success()
    {
      return AuthProviderStatus{};
    }

    /**
     * @brief Create a failed provider status.
     *
     * @param error Identity error.
     * @return Failed provider status.
     */
    [[nodiscard]] static AuthProviderStatus failure(
        errors::IdentityError error)
    {
      return AuthProviderStatus{std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when no error occurred.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return error_.ok();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when an error occurred.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the operation error.
     *
     * @return Identity error.
     */
    [[nodiscard]] const errors::IdentityError &error() const noexcept
    {
      return error_;
    }

  private:
    AuthProviderStatus() = default;

    explicit AuthProviderStatus(errors::IdentityError error)
        : error_(std::move(error))
    {
    }

    errors::IdentityError error_;
  };

  /**
   * @brief Credentials used to register an account.
   */
  struct RegisterCredentials
  {
    std::string email;
    std::string password;
  };

  /**
   * @brief Credentials used to authenticate an account.
   */
  struct LoginCredentials
  {
    std::string email;
    std::string password;
  };

  /**
   * @brief Result returned after successful authentication.
   */
  struct ProviderLoginResult
  {
    domain::Account account;
    domain::AuthSession session;
  };

  /**
   * @brief Authentication provider contract used by Orelunza.
   *
   * The rest of the identity module depends on this interface rather than on
   * a concrete authentication library.
   */
  class AuthProvider
  {
  public:
    virtual ~AuthProvider() = default;

    /**
     * @brief Register a new account.
     *
     * @param credentials Registration credentials.
     * @return Created account or an identity error.
     */
    [[nodiscard]] virtual AuthProviderResult<domain::Account>
    register_account(const RegisterCredentials &credentials) = 0;

    /**
     * @brief Authenticate an account and create a session.
     *
     * @param credentials Login credentials.
     * @return Account and session or an identity error.
     */
    [[nodiscard]] virtual AuthProviderResult<ProviderLoginResult>
    login(const LoginCredentials &credentials) = 0;

    /**
     * @brief Authenticate an existing session.
     *
     * @param session_id Authentication session identifier.
     * @return Valid session or an identity error.
     */
    [[nodiscard]] virtual AuthProviderResult<domain::AuthSession>
    authenticate(std::string_view session_id) = 0;

    /**
     * @brief Revoke an authentication session.
     *
     * @param session_id Authentication session identifier.
     * @return Operation status.
     */
    [[nodiscard]] virtual AuthProviderStatus
    logout(std::string_view session_id) = 0;
  };
} // namespace orelunza::identity::auth

#endif // ORELUNZA_IDENTITY_AUTH_AUTH_PROVIDER_HPP_INCLUDED
