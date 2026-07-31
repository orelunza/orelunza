/**
 *
 * @file IdentityService.hpp
 * @author Softadastra
 * @brief Application service for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_SERVICES_IDENTITY_SERVICE_HPP_INCLUDED
#define ORELUNZA_IDENTITY_SERVICES_IDENTITY_SERVICE_HPP_INCLUDED

#include <identity/auth/AuthProvider.hpp>
#include <identity/domain/Account.hpp>
#include <identity/domain/AuthSession.hpp>
#include <identity/domain/Human.hpp>
#include <identity/domain/Persona.hpp>
#include <identity/errors/IdentityError.hpp>
#include <identity/repositories/IdentityRepository.hpp>

#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::identity::services
{
  /**
   * @brief Result returned by identity service operations.
   *
   * @tparam T Successful value type.
   */
  template <typename T>
  class IdentityServiceResult
  {
  public:
    /**
     * @brief Create a successful service result.
     *
     * @param value Successful value.
     * @return Successful result.
     */
    [[nodiscard]] static IdentityServiceResult success(T value)
    {
      return IdentityServiceResult{std::move(value)};
    }

    /**
     * @brief Create a failed service result.
     *
     * @param error Identity error.
     * @return Failed result.
     */
    [[nodiscard]] static IdentityServiceResult failure(
        errors::IdentityError error)
    {
      return IdentityServiceResult{std::move(error)};
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
     * @return Successful value.
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
     * @return Successful value.
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
     * @return Successful value.
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
    explicit IdentityServiceResult(T value)
        : value_(std::move(value))
    {
    }

    explicit IdentityServiceResult(
        errors::IdentityError error)
        : error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::IdentityError error_;
  };

  /**
   * @brief Status returned by service operations without a value.
   */
  class IdentityServiceStatus
  {
  public:
    /**
     * @brief Create a successful service status.
     *
     * @return Successful status.
     */
    [[nodiscard]] static IdentityServiceStatus success()
    {
      return IdentityServiceStatus{};
    }

    /**
     * @brief Create a failed service status.
     *
     * @param error Identity error.
     * @return Failed status.
     */
    [[nodiscard]] static IdentityServiceStatus failure(
        errors::IdentityError error)
    {
      return IdentityServiceStatus{std::move(error)};
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
    IdentityServiceStatus() = default;

    explicit IdentityServiceStatus(
        errors::IdentityError error)
        : error_(std::move(error))
    {
    }

    errors::IdentityError error_;
  };

  /**
   * @brief Request used to register a complete Orelunza identity.
   */
  struct RegisterIdentityRequest
  {
    std::string email;
    std::string password;
    std::string display_name;
    std::string avatar;
  };

  /**
   * @brief Request used to authenticate an Orelunza identity.
   */
  struct LoginIdentityRequest
  {
    std::string email;
    std::string password;
  };

  /**
   * @brief Complete identity created during registration.
   */
  struct RegisteredIdentity
  {
    domain::Account account;
    domain::Human human;
    domain::Persona persona;
  };

  /**
   * @brief Complete identity returned after login.
   */
  struct LoggedInIdentity
  {
    domain::Account account;
    domain::AuthSession session;
    domain::Human human;
    domain::Persona persona;
  };

  /**
   * @brief Identity resolved from an authenticated session.
   */
  struct CurrentIdentity
  {
    domain::AuthSession session;
    domain::Human human;
    domain::Persona persona;
  };

  /**
   * @brief Coordinates authentication and Orelunza identity persistence.
   */
  class IdentityService
  {
  public:
    /**
     * @brief Construct the identity service.
     *
     * Both dependencies must outlive this service.
     *
     * @param auth_provider Authentication provider.
     * @param repository Identity repository.
     */
    IdentityService(
        auth::AuthProvider &auth_provider,
        repositories::IdentityRepository &repository) noexcept;

    /**
     * @brief Register an account, human identity, and public persona.
     *
     * @param request Registration request.
     * @return Registered identity or an identity error.
     */
    [[nodiscard]] IdentityServiceResult<RegisteredIdentity>
    register_identity(const RegisterIdentityRequest &request);

    /**
     * @brief Authenticate an account and resolve its Orelunza identity.
     *
     * @param request Login request.
     * @return Logged-in identity or an identity error.
     */
    [[nodiscard]] IdentityServiceResult<LoggedInIdentity>
    login(const LoginIdentityRequest &request);

    /**
     * @brief Authenticate a session and resolve the current identity.
     *
     * @param session_id Authentication session identifier.
     * @return Current identity or an identity error.
     */
    [[nodiscard]] IdentityServiceResult<CurrentIdentity>
    authenticate(std::string_view session_id);

    /**
     * @brief Revoke an authentication session.
     *
     * @param session_id Authentication session identifier.
     * @return Operation status.
     */
    [[nodiscard]] IdentityServiceStatus
    logout(std::string_view session_id);

  private:
    [[nodiscard]] IdentityServiceResult<domain::Human>
    find_human(const domain::AccountId &account_id) const;

    [[nodiscard]] IdentityServiceResult<domain::Persona>
    find_persona(const domain::HumanId &human_id) const;

    [[nodiscard]] IdentityServiceResult<std::string>
    make_secure_id(std::string_view prefix) const;

    [[nodiscard]] std::int64_t now_seconds() const noexcept;

    auth::AuthProvider *auth_provider_ = nullptr;
    repositories::IdentityRepository *repository_ = nullptr;
  };
} // namespace orelunza::identity::services

#endif // ORELUNZA_IDENTITY_SERVICES_IDENTITY_SERVICE_HPP_INCLUDED
