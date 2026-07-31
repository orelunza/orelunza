/**
 *
 * @file IdentityError.cpp
 * @author Softadastra
 * @brief Error implementations for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/errors/IdentityError.hpp>

#include <utility>

namespace orelunza::identity::errors
{
  IdentityError::IdentityError(
      IdentityErrorCode code,
      std::string message)
      : code_(code),
        message_(std::move(message))
  {
  }

  bool IdentityError::ok() const noexcept
  {
    return code_ == IdentityErrorCode::None;
  }

  bool IdentityError::has_error() const noexcept
  {
    return !ok();
  }

  IdentityErrorCode IdentityError::code() const noexcept
  {
    return code_;
  }

  const std::string &IdentityError::message() const noexcept
  {
    return message_;
  }

  bool IdentityError::is(
      IdentityErrorCode code) const noexcept
  {
    return code_ == code;
  }

  std::string_view to_string(
      IdentityErrorCode code) noexcept
  {
    switch (code)
    {
    case IdentityErrorCode::None:
      return "none";

    case IdentityErrorCode::InvalidInput:
      return "invalid_input";

    case IdentityErrorCode::InvalidEmail:
      return "invalid_email";

    case IdentityErrorCode::InvalidPassword:
      return "invalid_password";

    case IdentityErrorCode::InvalidCredentials:
      return "invalid_credentials";

    case IdentityErrorCode::AccountNotFound:
      return "account_not_found";

    case IdentityErrorCode::AccountAlreadyExists:
      return "account_already_exists";

    case IdentityErrorCode::AccountDisabled:
      return "account_disabled";

    case IdentityErrorCode::EmailVerificationRequired:
      return "email_verification_required";

    case IdentityErrorCode::HumanNotFound:
      return "human_not_found";

    case IdentityErrorCode::PersonaNotFound:
      return "persona_not_found";

    case IdentityErrorCode::InvalidSession:
      return "invalid_session";

    case IdentityErrorCode::SessionExpired:
      return "session_expired";

    case IdentityErrorCode::SessionRevoked:
      return "session_revoked";

    case IdentityErrorCode::StorageError:
      return "storage_error";

    case IdentityErrorCode::AuthProviderError:
      return "auth_provider_error";

    case IdentityErrorCode::ConfigurationError:
      return "configuration_error";

    case IdentityErrorCode::Unknown:
      return "unknown";
    }

    return "unknown";
  }

  IdentityError make_identity_ok()
  {
    return IdentityError{};
  }

  IdentityError make_identity_error(
      IdentityErrorCode code,
      std::string message)
  {
    return IdentityError{
        code,
        std::move(message)};
  }
} // namespace orelunza::identity::errors
