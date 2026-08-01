/**
 *
 * @file NatureController.cpp
 * @author Softadastra
 * @brief HTTP controller implementation for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/controllers/NatureController.hpp>

#include <nature/domain/NatureIds.hpp>
#include <nature/errors/NatureError.hpp>
#include <nature/http/NatureDtos.hpp>
#include <nature/services/NatureService.hpp>

#include <world/domain/WorldIds.hpp>

#include <vix.hpp>
#include <vix/json.hpp>

#include <string>
#include <utility>

namespace
{
  namespace nature_domain =
      orelunza::nature::domain;

  namespace nature_errors =
      orelunza::nature::errors;

  namespace nature_http =
      orelunza::nature::http;

  namespace world_domain =
      orelunza::world::domain;

  using Json = vix::json::Json;

  /**
   * @brief Return the HTTP status associated with a nature error.
   *
   * @param code Nature error code.
   * @return HTTP status code.
   */
  [[nodiscard]] int nature_error_status(
      nature_errors::NatureErrorCode code) noexcept
  {
    switch (code)
    {
    case nature_errors::NatureErrorCode::InvalidInput:
    case nature_errors::NatureErrorCode::InvalidBiomeId:
    case nature_errors::NatureErrorCode::InvalidNaturalAreaId:
    case nature_errors::NatureErrorCode::InvalidRegionId:
    case nature_errors::NatureErrorCode::InvalidPlaceId:
      return 400;

    case nature_errors::NatureErrorCode::BiomeNotFound:
    case nature_errors::NatureErrorCode::NaturalAreaNotFound:
    case nature_errors::NatureErrorCode::EnvironmentStateNotFound:
    case nature_errors::NatureErrorCode::RegionNotFound:
    case nature_errors::NatureErrorCode::PlaceNotFound:
      return 404;

    case nature_errors::NatureErrorCode::BiomeDisabled:
    case nature_errors::NatureErrorCode::NaturalAreaDisabled:
      return 409;

    case nature_errors::NatureErrorCode::StorageError:
    case nature_errors::NatureErrorCode::ConfigurationError:
    case nature_errors::NatureErrorCode::Unknown:
      return 500;

    case nature_errors::NatureErrorCode::None:
      return 200;
    }

    return 500;
  }

  /**
   * @brief Serialize a biome response.
   *
   * @param biome Biome response.
   * @return JSON object.
   */
  [[nodiscard]] Json biome_json(
      const nature_http::BiomeResponse &biome)
  {
    return vix::json::o(
        "id", biome.id,
        "name", biome.name,
        "slug", biome.slug,
        "description", biome.description,
        "terrain_type", biome.terrain_type,
        "vegetation_type", biome.vegetation_type,
        "enabled", biome.enabled,
        "created_at", biome.created_at,
        "updated_at", biome.updated_at);
  }

  /**
   * @brief Serialize a natural area response.
   *
   * @param area Natural area response.
   * @return JSON object.
   */
  [[nodiscard]] Json natural_area_json(
      const nature_http::NaturalAreaResponse &area)
  {
    Json payload = vix::json::o(
        "id", area.id,
        "biome_id", area.biome_id,
        "region_id", area.region_id,
        "name", area.name,
        "description", area.description,
        "enabled", area.enabled,
        "created_at", area.created_at,
        "updated_at", area.updated_at);

    if (area.place_id.has_value())
    {
      payload["place_id"] = area.place_id.value();
    }
    else
    {
      payload["place_id"] = nullptr;
    }

    return payload;
  }

  /**
   * @brief Serialize an environment state response.
   *
   * @param state Environment state response.
   * @return JSON object.
   */
  [[nodiscard]] Json environment_state_json(
      const nature_http::EnvironmentStateResponse &state)
  {
    return vix::json::o(
        "natural_area_id", state.natural_area_id,
        "terrain_condition", state.terrain_condition,
        "vegetation_condition", state.vegetation_condition,
        "ambient_description", state.ambient_description,
        "vegetation_density", state.vegetation_density,
        "water_level", state.water_level,
        "updated_at", state.updated_at);
  }

  /**
   * @brief Serialize the nature overview.
   *
   * @param nature Nature response.
   * @return JSON object.
   */
  [[nodiscard]] Json nature_json(
      const nature_http::NatureResponse &nature)
  {
    Json biomes = vix::json::arr();

    for (const auto &biome : nature.biomes)
    {
      biomes.push_back(
          biome_json(biome));
    }

    return vix::json::o(
        "ok", true,
        "biomes", std::move(biomes));
  }

  /**
   * @brief Write a nature error response.
   *
   * @param response Vix HTTP response.
   * @param error Nature error.
   */
  void write_nature_error(
      vix::Response &response,
      const nature_errors::NatureError &error)
  {
    response
        .status(nature_error_status(error.code()))
        .json(vix::json::o(
            "ok", false,
            "error", std::string{nature_errors::to_string(error)},
            "message", error.message()));
  }
} // namespace

namespace orelunza::nature::controllers
{
  void NatureController::register_routes(
      vix::App &app,
      services::NatureService &nature_service)
  {
    app.get(
        "/api/nature",
        [&nature_service](
            vix::Request &,
            vix::Response &response)
        {
          auto result =
              nature_service.get_nature();

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          const auto output =
              nature_http::NatureResponse::from_service(
                  result.value());

          response
              .status(200)
              .json(nature_json(output));
        });

    app.get(
        "/api/nature/biomes",
        [&nature_service](
            vix::Request &,
            vix::Response &response)
        {
          auto result =
              nature_service.list_biomes();

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          Json biomes = vix::json::arr();

          for (const auto &biome : result.value())
          {
            biomes.push_back(
                biome_json(
                    nature_http::BiomeResponse::from_domain(
                        biome)));
          }

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "biomes", std::move(biomes)));
        });

    /*
     * Register the more specific biome-area route before the generic
     * biome identifier route.
     */
    app.get(
        "/api/nature/biomes/{id}/areas",
        [&nature_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string biome_id =
              request.param("id");

          auto result =
              nature_service.list_biome_areas(
                  nature_domain::BiomeId{
                      biome_id});

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          Json areas = vix::json::arr();

          for (const auto &area : result.value())
          {
            areas.push_back(
                natural_area_json(
                    nature_http::NaturalAreaResponse::
                        from_domain(area)));
          }

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "biome_id", biome_id,
                  "areas", std::move(areas)));
        });

    app.get(
        "/api/nature/biomes/{id}",
        [&nature_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string biome_id =
              request.param("id");

          auto result =
              nature_service.get_biome(
                  nature_domain::BiomeId{
                      biome_id});

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          const auto output =
              nature_http::BiomeResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "biome", biome_json(output)));
        });

    /*
     * Register the state route before the generic natural area route.
     */
    app.get(
        "/api/nature/areas/{id}/state",
        [&nature_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string natural_area_id =
              request.param("id");

          auto result =
              nature_service.get_environment_state(
                  nature_domain::NaturalAreaId{
                      natural_area_id});

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          const auto output =
              nature_http::EnvironmentStateResponse::
                  from_domain(result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "state",
                  environment_state_json(output)));
        });

    app.get(
        "/api/nature/areas/{id}",
        [&nature_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string natural_area_id =
              request.param("id");

          auto result =
              nature_service.get_natural_area(
                  nature_domain::NaturalAreaId{
                      natural_area_id});

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          const auto output =
              nature_http::NaturalAreaResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "area",
                  natural_area_json(output)));
        });

    app.get(
        "/api/nature/regions/{region_id}",
        [&nature_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string region_id =
              request.param("region_id");

          auto result =
              nature_service.get_region_nature(
                  world_domain::RegionId{
                      region_id});

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          const auto output =
              nature_http::NaturalAreaResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "region_id", region_id,
                  "area",
                  natural_area_json(output)));
        });

    app.get(
        "/api/nature/places/{place_id}",
        [&nature_service](
            vix::Request &request,
            vix::Response &response)
        {
          const std::string place_id =
              request.param("place_id");

          auto result =
              nature_service.get_place_nature(
                  world_domain::PlaceId{
                      place_id});

          if (result.failed())
          {
            write_nature_error(
                response,
                result.error());

            return;
          }

          const auto output =
              nature_http::NaturalAreaResponse::from_domain(
                  result.value());

          response
              .status(200)
              .json(vix::json::o(
                  "ok", true,
                  "place_id", place_id,
                  "area",
                  natural_area_json(output)));
        });
  }
} // namespace orelunza::nature::controllers
