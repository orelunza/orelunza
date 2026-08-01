/**
 *
 * @file WorldController.cpp
 * @author Softadastra
 * @brief HTTP controller implementation for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <world/controllers/WorldController.hpp>

#include <identity/services/IdentityService.hpp>

#include <world/errors/WorldError.hpp>
#include <world/http/WorldDtos.hpp>
#include <world/services/WorldService.hpp>

#include <vix.hpp>
#include <vix/json.hpp>

#include <cstdint>
#include <exception>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace
{
  namespace identity_services =
      orelunza::identity::services;

  namespace world_domain =
      orelunza::world::domain;

  namespace world_errors =
      orelunza::world::errors;

  namespace world_http =
      orelunza::world::http;

  namespace world_services =
      orelunza::world::services;

  using Json = vix::json::Json;

  /**
   * @brief Return the HTTP status associated with a world error.
   *
   * @param code World error code.
   * @return HTTP status code.
   */
  [[nodiscard]] int world_error_status(
      world_errors::WorldErrorCode code) noexcept
  {
    switch (code)
    {
    case world_errors::WorldErrorCode::InvalidInput:
    case world_errors::WorldErrorCode::InvalidWorldId:
    case world_errors::WorldErrorCode::InvalidRegionId:
    case world_errors::WorldErrorCode::InvalidPlaceId:
      return 400;

    case world_errors::WorldErrorCode::WorldNotFound:
    case world_errors::WorldErrorCode::RegionNotFound:
    case world_errors::WorldErrorCode::PlaceNotFound:
    case world_errors::WorldErrorCode::PositionNotFound:
      return 404;

    case world_errors::WorldErrorCode::RegionDisabled:
    case world_errors::WorldErrorCode::PlaceDisabled:
      return 409;

    case world_errors::WorldErrorCode::StorageError:
    case world_errors::WorldErrorCode::ConfigurationError:
    case world_errors::WorldErrorCode::Unknown:
      return 500;

    case world_errors::WorldErrorCode::None:
      return 200;
    }

    return 500;
  }

  /**
   * @brief Serialize a region response.
   *
   * @param region Region response.
   * @return JSON object.
   */
  [[nodiscard]] Json region_json(
      const world_http::RegionResponse &region)
  {
    return vix::json::o(
        "id", region.id,
        "name", region.name,
        "slug", region.slug,
        "description", region.description,
        "enabled", region.enabled,
        "created_at", region.created_at,
        "updated_at", region.updated_at);
  }

  /**
   * @brief Serialize a place response.
   *
   * @param place Place response.
   * @return JSON object.
   */
  [[nodiscard]] Json place_json(
      const world_http::PlaceResponse &place)
  {
    return vix::json::o(
        "id", place.id,
        "region_id", place.region_id,
        "name", place.name,
        "description", place.description,
        "type", place.type,
        "position_x", place.position_x,
        "position_y", place.position_y,
        "enabled", place.enabled,
        "created_at", place.created_at,
        "updated_at", place.updated_at);
  }

  /**
   * @brief Serialize a human position response.
   *
   * @param position Human position response.
   * @return JSON object.
   */
  [[nodiscard]] Json human_position_json(
      const world_http::HumanPositionResponse &position)
  {
    Json payload = vix::json::o(
        "human_id", position.human_id,
        "region_id", position.region_id,
        "position_x", position.position_x,
        "position_y", position.position_y,
        "updated_at", position.updated_at);

    if (position.place_id.has_value())
    {
      payload["place_id"] = position.place_id.value();
    }
    else
    {
      payload["place_id"] = nullptr;
    }

    return payload;
  }

  /**
   * @brief Serialize a world response.
   *
   * @param world World response.
   * @return JSON object.
   */
  [[nodiscard]] Json world_json(
      const world_http::WorldResponse &world)
  {
    Json regions = vix::json::arr();

    for (const auto &region : world.regions)
    {
      regions.push_back(region_json(region));
    }

    return vix::json::o(
        "ok", true,
        "world_id", world.id,
        "regions", std::move(regions));
  }

  /**
   * @brief Write a world error response.
   *
   * @param response Vix HTTP response.
   * @param error World error.
   */
  void write_world_error(
      vix::Response &response,
      const world_errors::WorldError &error)
  {
    response
        .status(world_error_status(error.code()))
        .json(vix::json::o(
            "ok", false,
            "error", std::string{world_errors::to_string(error)},
            "message", error.message()));
  }

  /**
   * @brief Write an invalid request response.
   *
   * @param response Vix HTTP response.
   * @param message Validation message.
   */
  void write_invalid_request(
      vix::Response &response,
      std::string message)
  {
    response
        .status(400)
        .json(vix::json::o(
            "ok", false,
            "error", "invalid_input",
            "message", std::move(message)));
  }

  /**
   * @brief Write an authentication error response.
   *
   * @param response Vix HTTP response.
   * @param message Authentication error message.
   */
  void write_unauthorized(
      vix::Response &response,
      std::string message)
  {
    response
        .status(401)
        .json(vix::json::o(
            "ok", false,
            "error", "invalid_session",
            "message", std::move(message)));
  }

  /**
   * @brief Trim spaces surrounding a string view.
   *
   * @param value Input value.
   * @return Trimmed view.
   */
  [[nodiscard]] std::string_view trim_view(
      std::string_view value) noexcept
  {
    while (!value.empty() &&
           (value.front() == ' ' ||
            value.front() == '\t'))
    {
      value.remove_prefix(1);
    }

    while (!value.empty() &&
           (value.back() == ' ' ||
            value.back() == '\t'))
    {
      value.remove_suffix(1);
    }

    return value;
  }

  /**
   * @brief Extract a named cookie from a Cookie header.
   *
   * @param request Vix HTTP request.
   * @param name Cookie name.
   * @return Cookie value or an empty string.
   */
  [[nodiscard]] std::string read_cookie(
      vix::Request &request,
      std::string_view name)
  {
    const std::string cookie_header =
        request.header("Cookie");

    std::string_view remaining{cookie_header};

    while (!remaining.empty())
    {
      const auto separator = remaining.find(';');

      auto entry = separator == std::string_view::npos
                       ? remaining
                       : remaining.substr(0, separator);

      entry = trim_view(entry);

      const auto equals = entry.find('=');

      if (equals != std::string_view::npos)
      {
        const auto cookie_name =
            trim_view(entry.substr(0, equals));

        const auto cookie_value =
            trim_view(entry.substr(equals + 1));

        if (cookie_name == name)
        {
          return std::string{cookie_value};
        }
      }

      if (separator == std::string_view::npos)
      {
        break;
      }

      remaining.remove_prefix(separator + 1);
    }

    return {};
  }

  /**
   * @brief Parse a movement request from the HTTP body.
   *
   * @param request Vix HTTP request.
   * @param output Parsed request.
   * @param error_message Validation error.
   * @return true when parsing succeeds.
   */
  [[nodiscard]] bool parse_move_request(
      vix::Request &request,
      world_http::MoveHumanRequest &output,
      std::string &error_message)
  {
    try
    {
      const auto payload =
          Json::parse(request.body());

      if (!payload.is_object())
      {
        error_message =
            "The request body must be a JSON object.";

        return false;
      }

      if (!payload.contains("region_id") ||
          !payload["region_id"].is_string())
      {
        error_message =
            "The region_id field is required.";

        return false;
      }

      output.region_id =
          payload["region_id"].get<std::string>();

      if (payload.contains("place_id") &&
          !payload["place_id"].is_null())
      {
        if (!payload["place_id"].is_string())
        {
          error_message =
              "The place_id field must be a string or null.";

          return false;
        }

        output.place_id =
            payload["place_id"].get<std::string>();
      }

      if (payload.contains("position_x"))
      {
        if (!payload["position_x"].is_number_integer())
        {
          error_message =
              "The position_x field must be an integer.";

          return false;
        }

        output.position_x =
            payload["position_x"].get<std::int64_t>();
      }

      if (payload.contains("position_y"))
      {
        if (!payload["position_y"].is_number_integer())
        {
          error_message =
              "The position_y field must be an integer.";

          return false;
        }

        output.position_y =
            payload["position_y"].get<std::int64_t>();
      }

      if (!output.valid())
      {
        error_message =
            "The movement request contains invalid values.";

        return false;
      }

      return true;
    }
    catch (const std::exception &exception)
    {
      error_message =
          std::string{"Invalid JSON request body: "} +
          exception.what();

      return false;
    }
  }
} // namespace

namespace orelunza::world::controllers
{
  void WorldController::register_routes(
      vix::App &app,
      services::WorldService &world_service,
      identity::services::IdentityService &identity_service)
  {
    app.get(
        "/api/world",
        [&world_service](
            vix::Request &,
            vix::Response &response)
        {
          auto result = world_service.get_world();

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          const auto output =
              world_http::WorldResponse::from_service(
                  result.value());

          response
              .status(200)
              .json(world_json(output));
        });

    app.get(
        "/api/world/regions",
        [&world_service](
            vix::Request &,
            vix::Response &response)
        {
          auto result = world_service.list_regions();

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          Json regions = vix::json::arr();

          for (const auto &region : result.value())
          {
            regions.push_back(
                region_json(
                    world_http::RegionResponse::from_domain(
                        region)));
          }

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "regions", std::move(regions)));
        });

    app.get(
        "/api/world/regions/{id}",
        [&world_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string region_id =
              request.param("id");

          auto result = world_service.get_region(
              world_domain::RegionId{
                  region_id});

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          const auto output =
              world_http::RegionResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "region", region_json(output)));
        });

    app.get(
        "/api/world/regions/{id}/places",
        [&world_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string region_id =
              request.param("id");

          auto result = world_service.list_places(
              world_domain::RegionId{
                  region_id});

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          Json places = vix::json::arr();

          for (const auto &place : result.value())
          {
            places.push_back(
                place_json(
                    world_http::PlaceResponse::from_domain(
                        place)));
          }

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "region_id", region_id,
                  "places", std::move(places)));
        });

    app.get(
        "/api/world/places/{id}",
        [&world_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string place_id =
              request.param("id");

          auto result = world_service.get_place(
              world_domain::PlaceId{
                  place_id});

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          const auto output =
              world_http::PlaceResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "place", place_json(output)));
        });

    app.get(
        "/api/world/me/position",
        [&world_service, &identity_service](
            vix::Request &request,
            vix::Response &response)
        {
          const auto session_id =
              read_cookie(
                  request,
                  "orelunza_session");

          if (session_id.empty())
          {
            write_unauthorized(
                response,
                "Authentication session is missing.");

            return;
          }

          auto identity_result =
              identity_service.authenticate(session_id);

          if (identity_result.failed())
          {
            write_unauthorized(
                response,
                identity_result.error().message());

            return;
          }

          auto result =
              world_service.get_human_position(
                  identity_result.value().human.id());

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          const auto output =
              world_http::HumanPositionResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "position",
                  human_position_json(output)));
        });

    app.post(
        "/api/world/me/move",
        [&world_service, &identity_service](
            vix::Request &request,
            vix::Response &response)
        {
          const auto session_id =
              read_cookie(
                  request,
                  "orelunza_session");

          if (session_id.empty())
          {
            write_unauthorized(
                response,
                "Authentication session is missing.");

            return;
          }

          auto identity_result =
              identity_service.authenticate(session_id);

          if (identity_result.failed())
          {
            write_unauthorized(
                response,
                identity_result.error().message());

            return;
          }

          world_http::MoveHumanRequest input;
          std::string parse_error;

          if (!parse_move_request(
                  request,
                  input,
                  parse_error))
          {
            write_invalid_request(
                response,
                std::move(parse_error));

            return;
          }

          world_services::MoveHumanRequest move_request{
              identity_result.value().human.id(),
              world_domain::RegionId{
                  input.region_id},
              std::nullopt,
              input.position_x,
              input.position_y};

          if (input.place_id.has_value())
          {
            move_request.place_id =
                world_domain::PlaceId{
                    input.place_id.value()};
          }

          auto result =
              world_service.move_human(move_request);

          if (result.failed())
          {
            write_world_error(
                response,
                result.error());

            return;
          }

          const auto output =
              world_http::HumanPositionResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "position",
                  human_position_json(output)));
        });
  }
} // namespace orelunza::world::controllers
