/**
 *
 * @file IdentityDtos.hpp
 * @author Softadastra
 * @brief HTTP data transfer objects for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_HTTP_IDENTITY_DTOS_HPP_INCLUDED
#define ORELUNZA_IDENTITY_HTTP_IDENTITY_DTOS_HPP_INCLUDED

#include <identity/domain/Account.hpp>
#include <identity/domain/AuthSession.hpp>
#include <identity/domain/Human.hpp>
#include <identity/domain/Persona.hpp>

#include <cstdint>
#include <string>
#include <utility>

namespace orelunza::identity::http
{
  /**
   * @brief HTTP request used to register an Orelunza identity.
   */
  struct RegisterRequest
  {
    std::string email;
    std::string password;
    std::string display_name;
    std::string avatar;

    /**
     * @brief Return whether the request contains its required fields.
     *
     * @return true when the request is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return !email.empty() &&
             !password.empty() &&
             !display_name.empty();
    }
  };

  /**
   * @brief HTTP response returned after identity registration.
   */
  struct RegisterResponse
  {
    std::string account_id;
    std::string human_id;
    std::string persona_id;
    std::string email;
    std::string display_name;
    std::string avatar;
    bool email_verified = false;
    bool active = true;
    std::int64_t created_at = 0;

    /**
     * @brief Build a registration response from domain models.
     *
     * @param account Registered account.
     * @param human Registered human identity.
     * @param persona Registered public persona.
     * @return Registration response.
     */
    [[nodiscard]] static RegisterResponse from_domain(
        const domain::Account &account,
        const domain::Human &human,
        const domain::Persona &persona)
    {
      return RegisterResponse{
          account.id().value(),
          human.id().value(),
          persona.id().value(),
          account.email(),
          persona.display_name(),
          persona.avatar(),
          account.email_verified(),
          account.active(),
          account.created_at()};
    }
  };

  /**
   * @brief HTTP request used to authenticate an account.
   */
  struct LoginRequest
  {
    std::string email;
    std::string password;

    /**
     * @brief Return whether the request contains its required fields.
     *
     * @return true when the request is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return !email.empty() && !password.empty();
    }
  };

  /**
   * @brief HTTP response returned after successful authentication.
   */
  struct LoginResponse
  {
    std::string account_id;
    std::string human_id;
    std::string persona_id;
    std::string session_id;
    std::string email;
    std::string display_name;
    std::string avatar;
    bool email_verified = false;
    bool active = true;
    std::int64_t session_expires_at = 0;

    /**
     * @brief Build a login response from domain models.
     *
     * @param account Authenticated account.
     * @param session Created authentication session.
     * @param human Human identity.
     * @param persona Public persona.
     * @return Login response.
     */
    [[nodiscard]] static LoginResponse from_domain(
        const domain::Account &account,
        const domain::AuthSession &session,
        const domain::Human &human,
        const domain::Persona &persona)
    {
      return LoginResponse{
          account.id().value(),
          human.id().value(),
          persona.id().value(),
          session.id().value(),
          account.email(),
          persona.display_name(),
          persona.avatar(),
          account.email_verified(),
          account.active(),
          session.expires_at()};
    }
  };

  /**
   * @brief HTTP response describing the authenticated identity.
   */
  struct CurrentIdentityResponse
  {
    std::string account_id;
    std::string human_id;
    std::string persona_id;
    std::string session_id;
    std::string display_name;
    std::string avatar;
    std::int64_t session_expires_at = 0;
    std::int64_t last_seen_at = 0;

    /**
     * @brief Build a current-identity response from domain models.
     *
     * @param session Authentication session.
     * @param human Human identity.
     * @param persona Public persona.
     * @return Current identity response.
     */
    [[nodiscard]] static CurrentIdentityResponse from_domain(
        const domain::AuthSession &session,
        const domain::Human &human,
        const domain::Persona &persona)
    {
      return CurrentIdentityResponse{
          session.account_id().value(),
          human.id().value(),
          persona.id().value(),
          session.id().value(),
          persona.display_name(),
          persona.avatar(),
          session.expires_at(),
          session.last_seen_at()};
    }
  };

  /**
   * @brief Stable HTTP error response.
   */
  struct ErrorResponse
  {
    std::string code;
    std::string message;
  };
} // namespace orelunza::identity::http

#endif // ORELUNZA_IDENTITY_HTTP_IDENTITY_DTOS_HPP_INCLUDED
