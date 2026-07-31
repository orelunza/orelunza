/**
 *
 * @file IdentityService.cpp
 * @author Softadastra
 * @brief Application service implementation for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/services/IdentityService.hpp>

#include <vix/crypto/hex.hpp>
#include <vix/crypto/random.hpp>
#include <vix/time/Clock.hpp>

#include <array>
#include <cstdint>
#include <string>
#include <utility>

namespace orelunza::identity::services
{
  namespace
  {
    [[nodiscard]] errors::IdentityError invalid_input_error(
        std::string message)
    {
      return errors::make_identity_error(
          errors::IdentityErrorCode::InvalidInput,
          std::move(message));
    }

    [[nodiscard]] errors::IdentityError human_not_found_error()
    {
      return errors::make_identity_error(
          errors::IdentityErrorCode::HumanNotFound,
          "No human identity exists for this account.");
    }

    [[nodiscard]] errors::IdentityError persona_not_found_error()
    {
      return errors::make_identity_error(
          errors::IdentityErrorCode::PersonaNotFound,
          "No persona exists for this human identity.");
    }

    [[nodiscard]] errors::IdentityError identifier_error(
        std::string message)
    {
      return errors::make_identity_error(
          errors::IdentityErrorCode::Unknown,
          std::move(message));
    }
  } // namespace

  IdentityService::IdentityService(
      auth::AuthProvider &auth_provider,
      repositories::IdentityRepository &repository) noexcept
      : auth_provider_(&auth_provider),
        repository_(&repository)
  {
  }

  IdentityServiceResult<RegisteredIdentity>
  IdentityService::register_identity(
      const RegisterIdentityRequest &request)
  {
    if (request.display_name.empty())
    {
      return IdentityServiceResult<RegisteredIdentity>::failure(
          invalid_input_error(
              "Display name cannot be empty."));
    }

    auto human_id_value = make_secure_id("human");

    if (human_id_value.failed())
    {
      return IdentityServiceResult<RegisteredIdentity>::failure(
          human_id_value.error());
    }

    auto persona_id_value = make_secure_id("persona");

    if (persona_id_value.failed())
    {
      return IdentityServiceResult<RegisteredIdentity>::failure(
          persona_id_value.error());
    }

    auth::RegisterCredentials credentials{
        request.email,
        request.password};

    auto registered =
        auth_provider_->register_account(credentials);

    if (registered.failed())
    {
      return IdentityServiceResult<RegisteredIdentity>::failure(
          registered.error());
    }

    domain::Account account = registered.value();

    const auto now = now_seconds();

    domain::Human human{
        domain::HumanId{human_id_value.value()},
        account.id(),
        now,
        now};

    domain::Persona persona{
        domain::PersonaId{persona_id_value.value()},
        human.id(),
        request.display_name,
        request.avatar,
        now,
        now};

    auto human_created =
        repository_->create_human(human);

    if (human_created.failed())
    {
      return IdentityServiceResult<RegisteredIdentity>::failure(
          human_created.error());
    }

    auto persona_created =
        repository_->create_persona(persona);

    if (persona_created.failed())
    {
      return IdentityServiceResult<RegisteredIdentity>::failure(
          persona_created.error());
    }

    RegisteredIdentity identity{
        std::move(account),
        std::move(human),
        std::move(persona)};

    return IdentityServiceResult<RegisteredIdentity>::success(
        std::move(identity));
  }

  IdentityServiceResult<LoggedInIdentity>
  IdentityService::login(
      const LoginIdentityRequest &request)
  {
    auth::LoginCredentials credentials{
        request.email,
        request.password};

    auto authenticated =
        auth_provider_->login(credentials);

    if (authenticated.failed())
    {
      return IdentityServiceResult<LoggedInIdentity>::failure(
          authenticated.error());
    }

    const auto &provider_result = authenticated.value();

    auto human = find_human(
        provider_result.account.id());

    if (human.failed())
    {
      return IdentityServiceResult<LoggedInIdentity>::failure(
          human.error());
    }

    auto persona = find_persona(
        human.value().id());

    if (persona.failed())
    {
      return IdentityServiceResult<LoggedInIdentity>::failure(
          persona.error());
    }

    LoggedInIdentity identity{
        provider_result.account,
        provider_result.session,
        human.value(),
        persona.value()};

    return IdentityServiceResult<LoggedInIdentity>::success(
        std::move(identity));
  }

  IdentityServiceResult<CurrentIdentity>
  IdentityService::authenticate(
      std::string_view session_id)
  {
    if (session_id.empty())
    {
      return IdentityServiceResult<CurrentIdentity>::failure(
          invalid_input_error(
              "Session id cannot be empty."));
    }

    auto authenticated =
        auth_provider_->authenticate(session_id);

    if (authenticated.failed())
    {
      return IdentityServiceResult<CurrentIdentity>::failure(
          authenticated.error());
    }

    domain::AuthSession session = authenticated.value();

    auto human = find_human(
        session.account_id());

    if (human.failed())
    {
      return IdentityServiceResult<CurrentIdentity>::failure(
          human.error());
    }

    auto persona = find_persona(
        human.value().id());

    if (persona.failed())
    {
      return IdentityServiceResult<CurrentIdentity>::failure(
          persona.error());
    }

    CurrentIdentity identity{
        std::move(session),
        human.value(),
        persona.value()};

    return IdentityServiceResult<CurrentIdentity>::success(
        std::move(identity));
  }

  IdentityServiceStatus IdentityService::logout(
      std::string_view session_id)
  {
    if (session_id.empty())
    {
      return IdentityServiceStatus::failure(
          invalid_input_error(
              "Session id cannot be empty."));
    }

    auto status = auth_provider_->logout(session_id);

    if (status.failed())
    {
      return IdentityServiceStatus::failure(
          status.error());
    }

    return IdentityServiceStatus::success();
  }

  IdentityServiceResult<domain::Human>
  IdentityService::find_human(
      const domain::AccountId &account_id) const
  {
    auto result =
        repository_->find_human_by_account_id(account_id);

    if (result.failed())
    {
      return IdentityServiceResult<domain::Human>::failure(
          result.error());
    }

    if (!result.value().has_value())
    {
      return IdentityServiceResult<domain::Human>::failure(
          human_not_found_error());
    }

    return IdentityServiceResult<domain::Human>::success(
        result.value().value());
  }

  IdentityServiceResult<domain::Persona>
  IdentityService::find_persona(
      const domain::HumanId &human_id) const
  {
    auto result =
        repository_->find_persona_by_human_id(human_id);

    if (result.failed())
    {
      return IdentityServiceResult<domain::Persona>::failure(
          result.error());
    }

    if (!result.value().has_value())
    {
      return IdentityServiceResult<domain::Persona>::failure(
          persona_not_found_error());
    }

    return IdentityServiceResult<domain::Persona>::success(
        result.value().value());
  }

  IdentityServiceResult<std::string>
  IdentityService::make_secure_id(
      std::string_view prefix) const
  {
    std::array<std::uint8_t, 32> bytes{};

    auto random = vix::crypto::random_bytes(bytes);

    if (!random.ok())
    {
      return IdentityServiceResult<std::string>::failure(
          identifier_error(
              std::string(random.error().message)));
    }

    std::string identifier(prefix);
    identifier.push_back('_');
    identifier += vix::crypto::hex_lower(bytes);

    return IdentityServiceResult<std::string>::success(
        std::move(identifier));
  }

  std::int64_t IdentityService::now_seconds() const noexcept
  {
    return vix::time::SystemClock::now()
        .seconds_since_epoch();
  }
} // namespace orelunza::identity::services
