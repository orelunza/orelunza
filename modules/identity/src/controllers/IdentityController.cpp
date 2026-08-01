/**
 *
 * @file IdentityController.cpp
 * @author Softadastra
 * @brief HTTP controller implementation for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <identity/controllers/IdentityController.hpp>

#include <identity/errors/IdentityError.hpp>
#include <identity/http/IdentityDtos.hpp>
#include <identity/services/IdentityService.hpp>

#include <vix.hpp>

#include <cctype>
#include <cstdint>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::identity::controllers
{
  namespace
  {
    constexpr std::string_view session_cookie_name =
        "orelunza_session";

    [[nodiscard]] int http_status(
        errors::IdentityErrorCode code) noexcept
    {
      using Code = errors::IdentityErrorCode;

      switch (code)
      {
      case Code::None:
        return 200;

      case Code::InvalidInput:
      case Code::InvalidEmail:
      case Code::InvalidPassword:
        return 400;

      case Code::InvalidCredentials:
      case Code::InvalidSession:
      case Code::SessionExpired:
      case Code::SessionRevoked:
        return 401;

      case Code::AccountDisabled:
      case Code::EmailVerificationRequired:
        return 403;

      case Code::AccountNotFound:
      case Code::HumanNotFound:
      case Code::PersonaNotFound:
        return 404;

      case Code::AccountAlreadyExists:
        return 409;

      case Code::StorageError:
      case Code::AuthProviderError:
      case Code::ConfigurationError:
      case Code::Unknown:
        return 500;
      }

      return 500;
    }

    void send_error(
        vix::Response &response,
        const errors::IdentityError &error)
    {
      response
          .status(http_status(error.code()))
          .json({"ok", false,
                 "error", std::string(errors::to_string(error.code())),
                 "message", error.message()});
    }

    void send_invalid_body(
        vix::Response &response,
        std::string message)
    {
      send_error(
          response,
          errors::make_identity_error(
              errors::IdentityErrorCode::InvalidInput,
              std::move(message)));
    }

    [[nodiscard]] std::string read_json_string(
        const vix::json::Json &body,
        std::string_view field)
    {
      const std::string key(field);

      if (!body.is_object() ||
          !body.contains(key) ||
          !body[key].is_string())
      {
        return {};
      }

      return body[key].get<std::string>();
    }

    [[nodiscard]] http::RegisterRequest parse_register_request(
        const vix::Request &request)
    {
      const auto body = request.json();
      auto display_name = read_json_string(body, "display_name");

      if (display_name.empty())
      {
        display_name = read_json_string(body, "displayName");
      }

      return http::RegisterRequest{
          read_json_string(body, "email"),
          read_json_string(body, "password"),
          std::move(display_name),
          read_json_string(body, "avatar")};
    }

    [[nodiscard]] http::LoginRequest parse_login_request(
        const vix::Request &request)
    {
      const auto body = request.json();

      return http::LoginRequest{
          read_json_string(body, "email"),
          read_json_string(body, "password")};
    }

    [[nodiscard]] std::string trim_cookie_value(
        std::string_view value)
    {
      std::size_t first = 0;
      std::size_t last = value.size();

      while (first < last &&
             std::isspace(
                 static_cast<unsigned char>(value[first])) != 0)
      {
        ++first;
      }

      while (last > first &&
             std::isspace(
                 static_cast<unsigned char>(value[last - 1])) != 0)
      {
        --last;
      }

      return std::string(value.substr(first, last - first));
    }

    [[nodiscard]] std::string session_id_from_cookie(
        const vix::Request &request)
    {
      if (!request.has_header("Cookie"))
      {
        return {};
      }

      const std::string cookies = request.header("Cookie");
      std::size_t begin = 0;

      while (begin < cookies.size())
      {
        const std::size_t end = cookies.find(';', begin);

        const std::string_view entry{
            cookies.data() + begin,
            (end == std::string::npos ? cookies.size() : end) - begin};

        const std::size_t separator = entry.find('=');

        if (separator != std::string_view::npos)
        {
          const std::string name =
              trim_cookie_value(entry.substr(0, separator));

          if (name == session_cookie_name)
          {
            return trim_cookie_value(
                entry.substr(separator + 1));
          }
        }

        if (end == std::string::npos)
        {
          break;
        }

        begin = end + 1;
      }

      return {};
    }

    [[nodiscard]] std::string make_session_cookie(
        const domain::AuthSession &session)
    {
      std::string cookie;
      cookie.reserve(session.id().value().size() + 128);

      cookie += session_cookie_name;
      cookie += '=';
      cookie += session.id().value();
      cookie += "; Path=/";
      cookie += "; HttpOnly";
      cookie += "; SameSite=Lax";

      return cookie;
    }

    [[nodiscard]] std::string clear_session_cookie()
    {
      return std::string(session_cookie_name) +
             "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
    }
  } // namespace

  void IdentityController::register_routes(
      vix::App &app,
      services::IdentityService &service)
  {
    app.post(
        "/api/identity/register",
        [service = &service](
            vix::Request &request,
            vix::Response &response)
        {
          http::RegisterRequest dto;

          try
          {
            dto = parse_register_request(request);
          }
          catch (...)
          {
            send_invalid_body(
                response,
                "Request body must contain valid JSON.");

            return;
          }

          if (!dto.valid())
          {
            send_invalid_body(
                response,
                "Email, password, and display_name are required.");

            return;
          }

          services::RegisterIdentityRequest registration{
              dto.email,
              dto.password,
              dto.display_name,
              dto.avatar};

          auto result =
              service->register_identity(registration);

          if (result.failed())
          {
            send_error(response, result.error());
            return;
          }

          const auto &identity = result.value();

          const auto output = http::RegisterResponse::from_domain(
              identity.account,
              identity.human,
              identity.persona);

          response
              .status(201)
              .header(
                  "Set-Cookie",
                  make_session_cookie(identity.session))
              .json({"ok", true,
                     "account_id", output.account_id,
                     "human_id", output.human_id,
                     "persona_id", output.persona_id,
                     "session_id", identity.session.id().value(),
                     "email", output.email,
                     "display_name", output.display_name,
                     "avatar", output.avatar,
                     "email_verified", output.email_verified,
                     "active", output.active,
                     "session_expires_at", identity.session.expires_at(),
                     "created_at", output.created_at});
        });

    app.post(
        "/api/identity/login",
        [service = &service](
            vix::Request &request,
            vix::Response &response)
        {
          http::LoginRequest dto;

          try
          {
            dto = parse_login_request(request);
          }
          catch (...)
          {
            send_invalid_body(
                response,
                "Request body must contain valid JSON.");

            return;
          }

          if (!dto.valid())
          {
            send_invalid_body(
                response,
                "Email and password are required.");

            return;
          }

          services::LoginIdentityRequest login_request{
              dto.email,
              dto.password};

          auto result = service->login(login_request);

          if (result.failed())
          {
            send_error(response, result.error());
            return;
          }

          const auto &identity = result.value();

          const auto output = http::LoginResponse::from_domain(
              identity.account,
              identity.session,
              identity.human,
              identity.persona);

          response.header(
              "Set-Cookie",
              make_session_cookie(identity.session));

          response.json({"ok", true,
                         "account_id", output.account_id,
                         "human_id", output.human_id,
                         "persona_id", output.persona_id,
                         "session_id", output.session_id,
                         "email", output.email,
                         "display_name", output.display_name,
                         "avatar", output.avatar,
                         "email_verified", output.email_verified,
                         "active", output.active,
                         "session_expires_at", output.session_expires_at});
        });

    app.post(
        "/api/identity/logout",
        [service = &service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string session_id =
              session_id_from_cookie(request);

          if (session_id.empty())
          {
            send_error(
                response,
                errors::make_identity_error(
                    errors::IdentityErrorCode::InvalidSession,
                    "Authentication session is missing."));

            return;
          }

          auto status = service->logout(session_id);

          if (status.failed())
          {
            send_error(response, status.error());
            return;
          }

          response.header(
              "Set-Cookie",
              clear_session_cookie());

          response.json({"ok", true,
                         "message", "Session closed successfully."});
        });

    app.get(
        "/api/identity/me",
        [service = &service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string session_id =
              session_id_from_cookie(request);

          if (session_id.empty())
          {
            send_error(
                response,
                errors::make_identity_error(
                    errors::IdentityErrorCode::InvalidSession,
                    "Authentication session is missing."));

            return;
          }

          auto result = service->authenticate(session_id);

          if (result.failed())
          {
            send_error(response, result.error());
            return;
          }

          const auto &identity = result.value();

          const auto output =
              http::CurrentIdentityResponse::from_domain(
                  identity.session,
                  identity.human,
                  identity.persona);

          response.json({"ok", true,
                         "account_id", output.account_id,
                         "human_id", output.human_id,
                         "persona_id", output.persona_id,
                         "session_id", output.session_id,
                         "display_name", output.display_name,
                         "avatar", output.avatar,
                         "session_expires_at", output.session_expires_at,
                         "last_seen_at", output.last_seen_at});
        });
  }
} // namespace orelunza::identity::controllers
