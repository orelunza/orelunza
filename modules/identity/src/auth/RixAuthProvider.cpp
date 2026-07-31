/**
 *
 * @file RixAuthProvider.cpp
 * @author Softadastra
 * @brief Rix authentication adapter implementation for Orelunza.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/auth/RixAuthProvider.hpp>

#include <rix/auth/Auth.hpp>
#include <rix/auth/AuthError.hpp>
#include <rix/auth/Session.hpp>
#include <rix/auth/User.hpp>

#include <string>
#include <utility>

namespace orelunza::identity::auth
{
  RixAuthProvider::RixAuthProvider(
      rixlib::auth::Auth &auth) noexcept
      : auth_(&auth)
  {
  }

  AuthProviderResult<domain::Account>
  RixAuthProvider::register_account(
      const RegisterCredentials &credentials)
  {
    rixlib::auth::RegisterRequest request{
        credentials.email,
        credentials.password};

    auto result = auth_->register_user(request);

    if (result.failed())
    {
      return AuthProviderResult<domain::Account>::failure(
          map_error(result.error()));
    }

    return AuthProviderResult<domain::Account>::success(
        to_account(result.value()));
  }

  AuthProviderResult<ProviderLoginResult>
  RixAuthProvider::login(
      const LoginCredentials &credentials)
  {
    rixlib::auth::LoginRequest request{
        credentials.email,
        credentials.password};

    auto result = auth_->login(request);

    if (result.failed())
    {
      return AuthProviderResult<ProviderLoginResult>::failure(
          map_error(result.error()));
    }

    const auto &rix_result = result.value();

    ProviderLoginResult provider_result{
        to_account(rix_result.user),
        to_session(rix_result.session)};

    return AuthProviderResult<ProviderLoginResult>::success(
        std::move(provider_result));
  }

  AuthProviderResult<domain::AuthSession>
  RixAuthProvider::authenticate(std::string_view session_id)
  {
    auto result = auth_->authenticate_session(session_id);

    if (result.failed())
    {
      return AuthProviderResult<domain::AuthSession>::failure(
          map_error(result.error()));
    }

    return AuthProviderResult<domain::AuthSession>::success(
        to_session(result.value()));
  }

  AuthProviderStatus
  RixAuthProvider::logout(std::string_view session_id)
  {
    auto status = auth_->logout(session_id);

    if (status.failed())
    {
      return AuthProviderStatus::failure(
          map_error(status.error()));
    }

    return AuthProviderStatus::success();
  }

  domain::Account RixAuthProvider::to_account(
      const rixlib::auth::User &user)
  {
    return domain::Account{
        domain::AccountId{user.id()},
        user.email(),
        user.email_verified(),
        user.active(),
        user.created_at(),
        user.updated_at()};
  }

  domain::AuthSession RixAuthProvider::to_session(
      const rixlib::auth::Session &session)
  {
    return domain::AuthSession{
        domain::AuthSessionId{session.id()},
        domain::AccountId{session.user_id()},
        session.created_at(),
        session.expires_at(),
        session.last_seen_at(),
        session.revoked()};
  }

  errors::IdentityError RixAuthProvider::map_error(
      const rixlib::auth::AuthError &error)
  {
    using RixCode = rixlib::auth::AuthErrorCode;
    using IdentityCode = errors::IdentityErrorCode;

    IdentityCode code = IdentityCode::AuthProviderError;

    switch (error.code())
    {
    case RixCode::None:
      code = IdentityCode::None;
      break;

    case RixCode::InvalidInput:
      code = IdentityCode::InvalidInput;
      break;

    case RixCode::InvalidEmail:
      code = IdentityCode::InvalidEmail;
      break;

    case RixCode::InvalidPassword:
      code = IdentityCode::InvalidPassword;
      break;

    case RixCode::InvalidCredentials:
      code = IdentityCode::InvalidCredentials;
      break;

    case RixCode::UserNotFound:
      code = IdentityCode::AccountNotFound;
      break;

    case RixCode::UserAlreadyExists:
      code = IdentityCode::AccountAlreadyExists;
      break;

    case RixCode::UserDisabled:
      code = IdentityCode::AccountDisabled;
      break;

    case RixCode::EmailVerificationRequired:
      code = IdentityCode::EmailVerificationRequired;
      break;

    case RixCode::InvalidSession:
      code = IdentityCode::InvalidSession;
      break;

    case RixCode::SessionExpired:
      code = IdentityCode::SessionExpired;
      break;

    case RixCode::SessionRevoked:
      code = IdentityCode::SessionRevoked;
      break;

    case RixCode::StoreError:
      code = IdentityCode::StorageError;
      break;

    case RixCode::ConfigurationError:
      code = IdentityCode::ConfigurationError;
      break;

    case RixCode::InvalidState:
    case RixCode::InvalidToken:
    case RixCode::TokenExpired:
    case RixCode::TokenRevoked:
    case RixCode::CryptoError:
    case RixCode::ValidationError:
      code = IdentityCode::AuthProviderError;
      break;

    case RixCode::Unknown:
      code = IdentityCode::Unknown;
      break;
    }

    return errors::make_identity_error(
        code,
        error.message());
  }
} // namespace orelunza::identity::auth
