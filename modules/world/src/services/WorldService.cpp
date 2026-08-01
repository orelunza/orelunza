/**
 *
 * @file WorldService.cpp
 * @author Softadastra
 * @brief Application service implementation for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <world/services/WorldService.hpp>

#include <chrono>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace orelunza::world::services
{
  WorldService::WorldService(
      repositories::WorldRepository &repository)
      : repository_(&repository)
  {
  }

  WorldServiceResult<WorldOverview>
  WorldService::get_world() const
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<WorldOverview>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::ConfigurationError,
              "World repository is not configured."));
    }

    auto regions_result = list_regions();

    if (regions_result.failed())
    {
      return WorldServiceResult<WorldOverview>::failure(
          regions_result.error());
    }

    WorldOverview world{
        domain::WorldId{
            std::string{"orelunza"}},
        std::move(regions_result.value())};

    return WorldServiceResult<WorldOverview>::success(
        std::move(world));
  }

  WorldServiceResult<domain::Region>
  WorldService::get_region(
      const domain::RegionId &region_id) const
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<domain::Region>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::ConfigurationError,
              "World repository is not configured."));
    }

    if (!region_id.valid())
    {
      return WorldServiceResult<domain::Region>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidRegionId,
              "A valid region identifier is required."));
    }

    auto result =
        repository_->find_region_by_id(region_id);

    if (result.failed())
    {
      return WorldServiceResult<domain::Region>::failure(
          result.error());
    }

    if (!result.value().has_value())
    {
      return WorldServiceResult<domain::Region>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::RegionNotFound,
              "The requested world region was not found."));
    }

    auto region = std::move(result.value().value());

    if (region.disabled())
    {
      return WorldServiceResult<domain::Region>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::RegionDisabled,
              "The requested world region is disabled."));
    }

    return WorldServiceResult<domain::Region>::success(
        std::move(region));
  }

  WorldServiceResult<std::vector<domain::Region>>
  WorldService::list_regions() const
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<
          std::vector<domain::Region>>::failure(errors::make_world_error(errors::WorldErrorCode::ConfigurationError,
                                                                         "World repository is not configured."));
    }

    auto result = repository_->list_regions();

    if (result.failed())
    {
      return WorldServiceResult<
          std::vector<domain::Region>>::failure(result.error());
    }

    std::vector<domain::Region> regions;
    regions.reserve(result.value().size());

    for (auto &region : result.value())
    {
      if (region.enabled())
      {
        regions.push_back(std::move(region));
      }
    }

    return WorldServiceResult<
        std::vector<domain::Region>>::success(std::move(regions));
  }

  WorldServiceResult<std::vector<domain::Place>>
  WorldService::list_places(
      const domain::RegionId &region_id) const
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<
          std::vector<domain::Place>>::failure(errors::make_world_error(errors::WorldErrorCode::ConfigurationError,
                                                                        "World repository is not configured."));
    }

    auto region_result = get_region(region_id);

    if (region_result.failed())
    {
      return WorldServiceResult<
          std::vector<domain::Place>>::failure(region_result.error());
    }

    auto result =
        repository_->list_places_by_region(region_id);

    if (result.failed())
    {
      return WorldServiceResult<
          std::vector<domain::Place>>::failure(result.error());
    }

    std::vector<domain::Place> places;
    places.reserve(result.value().size());

    for (auto &place : result.value())
    {
      if (place.enabled())
      {
        places.push_back(std::move(place));
      }
    }

    return WorldServiceResult<
        std::vector<domain::Place>>::success(std::move(places));
  }

  WorldServiceResult<domain::Place>
  WorldService::get_place(
      const domain::PlaceId &place_id) const
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<domain::Place>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::ConfigurationError,
              "World repository is not configured."));
    }

    if (!place_id.valid())
    {
      return WorldServiceResult<domain::Place>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::InvalidPlaceId,
              "A valid place identifier is required."));
    }

    auto result =
        repository_->find_place_by_id(place_id);

    if (result.failed())
    {
      return WorldServiceResult<domain::Place>::failure(
          result.error());
    }

    if (!result.value().has_value())
    {
      return WorldServiceResult<domain::Place>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::PlaceNotFound,
              "The requested world place was not found."));
    }

    auto place = std::move(result.value().value());

    if (place.disabled())
    {
      return WorldServiceResult<domain::Place>::failure(
          errors::make_world_error(
              errors::WorldErrorCode::PlaceDisabled,
              "The requested world place is disabled."));
    }

    auto region_result =
        get_region(place.region_id());

    if (region_result.failed())
    {
      return WorldServiceResult<domain::Place>::failure(
          region_result.error());
    }

    return WorldServiceResult<domain::Place>::success(
        std::move(place));
  }

  WorldServiceResult<domain::HumanPosition>
  WorldService::get_human_position(
      const identity::domain::HumanId &human_id) const
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::ConfigurationError,
                                                                   "World repository is not configured."));
    }

    if (!human_id.valid())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidInput,
                                                                   "A valid human identifier is required."));
    }

    auto result =
        repository_->find_human_position(human_id);

    if (result.failed())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(result.error());
    }

    if (!result.value().has_value())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::PositionNotFound,
                                                                   "No world position exists for this human."));
    }

    auto position = std::move(result.value().value());

    auto region_result =
        get_region(position.region_id());

    if (region_result.failed())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(region_result.error());
    }

    if (position.has_place())
    {
      auto place_result =
          get_place(position.place_id().value());

      if (place_result.failed())
      {
        return WorldServiceResult<
            domain::HumanPosition>::failure(place_result.error());
      }

      if (!place_result.value().belongs_to(
              position.region_id()))
      {
        return WorldServiceResult<
            domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidInput,
                                                                     "The stored place does not belong "
                                                                     "to the stored region."));
      }
    }

    return WorldServiceResult<
        domain::HumanPosition>::success(std::move(position));
  }

  WorldServiceResult<domain::HumanPosition>
  WorldService::move_human(
      const MoveHumanRequest &request)
  {
    if (repository_ == nullptr)
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::ConfigurationError,
                                                                   "World repository is not configured."));
    }

    if (!request.valid())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidInput,
                                                                   "The human movement request is invalid."));
    }

    auto region_result =
        get_region(request.region_id);

    if (region_result.failed())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(region_result.error());
    }

    if (request.place_id.has_value())
    {
      auto place_result =
          get_place(request.place_id.value());

      if (place_result.failed())
      {
        return WorldServiceResult<
            domain::HumanPosition>::failure(place_result.error());
      }

      if (!place_result.value().belongs_to(
              request.region_id))
      {
        return WorldServiceResult<
            domain::HumanPosition>::failure(errors::make_world_error(errors::WorldErrorCode::InvalidInput,
                                                                     "The selected place does not belong "
                                                                     "to the selected region."));
      }
    }

    domain::HumanPosition position{
        request.human_id,
        request.region_id,
        request.place_id,
        request.position_x,
        request.position_y,
        now_seconds()};

    auto status =
        repository_->save_human_position(position);

    if (status.failed())
    {
      return WorldServiceResult<
          domain::HumanPosition>::failure(status.error());
    }

    return WorldServiceResult<
        domain::HumanPosition>::success(std::move(position));
  }

  std::int64_t WorldService::now_seconds()
  {
    return std::chrono::duration_cast<
               std::chrono::seconds>(
               std::chrono::system_clock::now()
                   .time_since_epoch())
        .count();
  }
} // namespace orelunza::world::services
