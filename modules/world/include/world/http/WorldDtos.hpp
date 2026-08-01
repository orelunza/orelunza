/**
 *
 * @file WorldDtos.hpp
 * @author Softadastra
 * @brief HTTP data transfer objects for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_HTTP_WORLD_DTOS_HPP_INCLUDED
#define ORELUNZA_WORLD_HTTP_WORLD_DTOS_HPP_INCLUDED

#include <world/domain/HumanPosition.hpp>
#include <world/domain/Place.hpp>
#include <world/domain/Region.hpp>
#include <world/services/WorldService.hpp>

#include <cstdint>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace orelunza::world::http
{
  /**
   * @brief Public HTTP representation of a world region.
   */
  struct RegionResponse
  {
    std::string id;
    std::string name;
    std::string slug;
    std::string description;

    bool enabled = true;

    std::int64_t created_at = 0;
    std::int64_t updated_at = 0;

    /**
     * @brief Build an HTTP response from a region domain model.
     *
     * @param region Region domain model.
     * @return Region response.
     */
    [[nodiscard]] static RegionResponse from_domain(
        const domain::Region &region)
    {
      return RegionResponse{
          region.id().value(),
          region.name(),
          region.slug(),
          region.description(),
          region.enabled(),
          region.created_at(),
          region.updated_at()};
    }
  };

  /**
   * @brief Public HTTP representation of a world place.
   */
  struct PlaceResponse
  {
    std::string id;
    std::string region_id;
    std::string name;
    std::string description;
    std::string type;

    std::int64_t position_x = 0;
    std::int64_t position_y = 0;

    bool enabled = true;

    std::int64_t created_at = 0;
    std::int64_t updated_at = 0;

    /**
     * @brief Build an HTTP response from a place domain model.
     *
     * @param place Place domain model.
     * @return Place response.
     */
    [[nodiscard]] static PlaceResponse from_domain(
        const domain::Place &place)
    {
      return PlaceResponse{
          place.id().value(),
          place.region_id().value(),
          place.name(),
          place.description(),
          place.type(),
          place.position_x(),
          place.position_y(),
          place.enabled(),
          place.created_at(),
          place.updated_at()};
    }
  };

  /**
   * @brief Public HTTP representation of the Orelunza world.
   */
  struct WorldResponse
  {
    std::string id;
    std::vector<RegionResponse> regions;

    /**
     * @brief Build an HTTP response from a world overview.
     *
     * @param world World overview.
     * @return World response.
     */
    [[nodiscard]] static WorldResponse from_service(
        const services::WorldOverview &world)
    {
      WorldResponse response;
      response.id = world.id.value();
      response.regions.reserve(world.regions.size());

      for (const auto &region : world.regions)
      {
        response.regions.push_back(
            RegionResponse::from_domain(region));
      }

      return response;
    }
  };

  /**
   * @brief Public HTTP representation of a human position.
   */
  struct HumanPositionResponse
  {
    std::string human_id;
    std::string region_id;
    std::optional<std::string> place_id;

    std::int64_t position_x = 0;
    std::int64_t position_y = 0;
    std::int64_t updated_at = 0;

    /**
     * @brief Build an HTTP response from a human position.
     *
     * @param position Human position domain model.
     * @return Human position response.
     */
    [[nodiscard]] static HumanPositionResponse from_domain(
        const domain::HumanPosition &position)
    {
      std::optional<std::string> place_id;

      if (position.has_place())
      {
        place_id = position.place_id()->value();
      }

      return HumanPositionResponse{
          position.human_id().value(),
          position.region_id().value(),
          std::move(place_id),
          position.position_x(),
          position.position_y(),
          position.updated_at()};
    }
  };

  /**
   * @brief HTTP request used to move the authenticated human.
   */
  struct MoveHumanRequest
  {
    std::string region_id;
    std::optional<std::string> place_id;

    std::int64_t position_x = 0;
    std::int64_t position_y = 0;

    /**
     * @brief Return whether the movement request is valid.
     *
     * @return true when required fields are present.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return !region_id.empty() &&
             (!place_id.has_value() ||
              !place_id->empty());
    }
  };

  /**
   * @brief Standard world module error response.
   */
  struct ErrorResponse
  {
    bool ok = false;
    std::string error;
    std::string message;
  };
} // namespace orelunza::world::http

#endif // ORELUNZA_WORLD_HTTP_WORLD_DTOS_HPP_INCLUDED
