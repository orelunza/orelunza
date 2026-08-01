/**
 *
 * @file NatureService.cpp
 * @author Softadastra
 * @brief Application service implementation for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/services/NatureService.hpp>

#include <world/services/WorldService.hpp>

#include <chrono>
#include <cstdint>
#include <iomanip>
#include <optional>
#include <random>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace orelunza::nature::services
{
  NatureService::NatureService(
      repositories::NatureRepository &repository,
      world::services::WorldService &world_service)
      : repository_(&repository),
        world_service_(&world_service)
  {
  }

  NatureServiceResult<NatureOverview>
  NatureService::get_nature() const
  {
    auto biomes_result = list_biomes();

    if (biomes_result.failed())
    {
      return NatureServiceResult<NatureOverview>::failure(
          biomes_result.error());
    }

    NatureOverview overview{
        std::move(biomes_result.value())};

    return NatureServiceResult<NatureOverview>::success(
        std::move(overview));
  }

  NatureServiceResult<std::vector<domain::Biome>>
  NatureService::list_biomes() const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          std::vector<domain::Biome>>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                         "Nature repository is not configured."));
    }

    auto result = repository_->list_biomes();

    if (result.failed())
    {
      return NatureServiceResult<
          std::vector<domain::Biome>>::failure(result.error());
    }

    std::vector<domain::Biome> biomes;
    biomes.reserve(result.value().size());

    for (auto &biome : result.value())
    {
      if (biome.enabled())
      {
        biomes.push_back(std::move(biome));
      }
    }

    return NatureServiceResult<
        std::vector<domain::Biome>>::success(std::move(biomes));
  }

  NatureServiceResult<domain::Biome>
  NatureService::get_biome(
      const domain::BiomeId &biome_id) const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::ConfigurationError,
              "Nature repository is not configured."));
    }

    if (!biome_id.valid())
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidBiomeId,
              "A valid biome identifier is required."));
    }

    auto result =
        repository_->find_biome_by_id(biome_id);

    if (result.failed())
    {
      return NatureServiceResult<domain::Biome>::failure(
          result.error());
    }

    if (!result.value().has_value())
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::BiomeNotFound,
              "The requested biome was not found."));
    }

    auto biome = std::move(result.value().value());

    if (biome.disabled())
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::BiomeDisabled,
              "The requested biome is disabled."));
    }

    return NatureServiceResult<domain::Biome>::success(
        std::move(biome));
  }

  NatureServiceResult<domain::NaturalArea>
  NatureService::get_natural_area(
      const domain::NaturalAreaId &natural_area_id) const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "Nature repository is not configured."));
    }

    if (!natural_area_id.valid())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidNaturalAreaId,
                                                                  "A valid natural area identifier is required."));
    }

    auto result =
        repository_->find_natural_area_by_id(
            natural_area_id);

    if (result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(result.error());
    }

    if (!result.value().has_value())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::NaturalAreaNotFound,
                                                                  "The requested natural area was not found."));
    }

    auto area = std::move(result.value().value());

    if (area.disabled())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::NaturalAreaDisabled,
                                                                  "The requested natural area is disabled."));
    }

    auto biome_result = get_biome(area.biome_id());

    if (biome_result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(biome_result.error());
    }

    if (world_service_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "World service is not configured."));
    }

    auto region_result =
        world_service_->get_region(area.region_id());

    if (region_result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::RegionNotFound,
                                                                  region_result.error().message()));
    }

    if (area.has_place())
    {
      auto place_result =
          world_service_->get_place(
              area.place_id().value());

      if (place_result.failed())
      {
        return NatureServiceResult<
            domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::PlaceNotFound,
                                                                    place_result.error().message()));
      }

      if (!place_result.value().belongs_to(
              area.region_id()))
      {
        return NatureServiceResult<
            domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidInput,
                                                                    "The natural area's place does not "
                                                                    "belong to its region."));
      }
    }

    return NatureServiceResult<
        domain::NaturalArea>::success(std::move(area));
  }

  NatureServiceResult<domain::NaturalArea>
  NatureService::get_region_nature(
      const world::domain::RegionId &region_id) const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "Nature repository is not configured."));
    }

    if (world_service_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "World service is not configured."));
    }

    if (!region_id.valid())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidRegionId,
                                                                  "A valid region identifier is required."));
    }

    auto region_result =
        world_service_->get_region(region_id);

    if (region_result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::RegionNotFound,
                                                                  region_result.error().message()));
    }

    auto result =
        repository_->find_natural_area_by_region(
            region_id);

    if (result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(result.error());
    }

    if (!result.value().has_value())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::NaturalAreaNotFound,
                                                                  "No region-wide natural area exists "
                                                                  "for this region."));
    }

    return get_natural_area(
        result.value()->id());
  }

  NatureServiceResult<domain::NaturalArea>
  NatureService::get_place_nature(
      const world::domain::PlaceId &place_id) const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "Nature repository is not configured."));
    }

    if (world_service_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "World service is not configured."));
    }

    if (!place_id.valid())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidPlaceId,
                                                                  "A valid place identifier is required."));
    }

    auto place_result =
        world_service_->get_place(place_id);

    if (place_result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::PlaceNotFound,
                                                                  place_result.error().message()));
    }

    auto result =
        repository_->find_natural_area_by_place(
            place_id);

    if (result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(result.error());
    }

    if (!result.value().has_value())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::NaturalAreaNotFound,
                                                                  "No natural area exists for this place."));
    }

    return get_natural_area(
        result.value()->id());
  }

  NatureServiceResult<
      std::vector<domain::NaturalArea>>
  NatureService::list_biome_areas(
      const domain::BiomeId &biome_id) const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          std::vector<domain::NaturalArea>>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                               "Nature repository is not configured."));
    }

    auto biome_result = get_biome(biome_id);

    if (biome_result.failed())
    {
      return NatureServiceResult<
          std::vector<domain::NaturalArea>>::failure(biome_result.error());
    }

    auto result =
        repository_->list_natural_areas_by_biome(
            biome_id);

    if (result.failed())
    {
      return NatureServiceResult<
          std::vector<domain::NaturalArea>>::failure(result.error());
    }

    std::vector<domain::NaturalArea> areas;
    areas.reserve(result.value().size());

    for (auto &area : result.value())
    {
      if (!area.enabled())
      {
        continue;
      }

      auto validated = get_natural_area(area.id());

      if (validated.ok())
      {
        areas.push_back(
            std::move(validated.value()));
      }
    }

    return NatureServiceResult<
        std::vector<domain::NaturalArea>>::success(std::move(areas));
  }

  NatureServiceResult<domain::EnvironmentState>
  NatureService::get_environment_state(
      const domain::NaturalAreaId &natural_area_id) const
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                       "Nature repository is not configured."));
    }

    auto area_result =
        get_natural_area(natural_area_id);

    if (area_result.failed())
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(area_result.error());
    }

    auto result =
        repository_->find_environment_state(
            natural_area_id);

    if (result.failed())
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(result.error());
    }

    if (!result.value().has_value())
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(errors::make_nature_error(errors::NatureErrorCode::
                                                                           EnvironmentStateNotFound,
                                                                       "No environment state exists "
                                                                       "for this natural area."));
    }

    return NatureServiceResult<
        domain::EnvironmentState>::success(std::move(result.value().value()));
  }

  NatureServiceResult<domain::Biome>
  NatureService::create_biome(
      const CreateBiomeRequest &request)
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::ConfigurationError,
              "Nature repository is not configured."));
    }

    if (!request.valid())
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "The biome creation request is invalid."));
    }

    auto existing =
        repository_->find_biome_by_slug(
            request.slug);

    if (existing.failed())
    {
      return NatureServiceResult<domain::Biome>::failure(
          existing.error());
    }

    if (existing.value().has_value())
    {
      return NatureServiceResult<domain::Biome>::failure(
          errors::make_nature_error(
              errors::NatureErrorCode::InvalidInput,
              "A biome already exists with this slug."));
    }

    const auto timestamp = now_seconds();

    domain::Biome biome{
        domain::BiomeId{
            make_identifier("biome")},
        request.name,
        request.slug,
        request.description,
        request.terrain_type,
        request.vegetation_type,
        request.enabled,
        timestamp,
        timestamp};

    auto status =
        repository_->create_biome(biome);

    if (status.failed())
    {
      return NatureServiceResult<domain::Biome>::failure(
          status.error());
    }

    return NatureServiceResult<domain::Biome>::success(
        std::move(biome));
  }

  NatureServiceResult<domain::NaturalArea>
  NatureService::create_natural_area(
      const CreateNaturalAreaRequest &request)
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "Nature repository is not configured."));
    }

    if (world_service_ == nullptr)
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                  "World service is not configured."));
    }

    if (!request.valid())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidInput,
                                                                  "The natural area creation request is invalid."));
    }

    auto biome_result =
        get_biome(request.biome_id);

    if (biome_result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(biome_result.error());
    }

    auto region_result =
        world_service_->get_region(
            request.region_id);

    if (region_result.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::RegionNotFound,
                                                                  region_result.error().message()));
    }

    if (request.place_id.has_value())
    {
      auto place_result =
          world_service_->get_place(
              request.place_id.value());

      if (place_result.failed())
      {
        return NatureServiceResult<
            domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::PlaceNotFound,
                                                                    place_result.error().message()));
      }

      if (!place_result.value().belongs_to(
              request.region_id))
      {
        return NatureServiceResult<
            domain::NaturalArea>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidInput,
                                                                    "The selected place does not belong "
                                                                    "to the selected region."));
      }
    }

    const auto timestamp = now_seconds();

    domain::NaturalArea area{
        domain::NaturalAreaId{
            make_identifier("area")},
        request.biome_id,
        request.region_id,
        request.place_id,
        request.name,
        request.description,
        request.enabled,
        timestamp,
        timestamp};

    auto status =
        repository_->create_natural_area(area);

    if (status.failed())
    {
      return NatureServiceResult<
          domain::NaturalArea>::failure(status.error());
    }

    return NatureServiceResult<
        domain::NaturalArea>::success(std::move(area));
  }

  NatureServiceResult<domain::EnvironmentState>
  NatureService::update_environment_state(
      const UpdateEnvironmentStateRequest &request)
  {
    if (repository_ == nullptr)
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(errors::make_nature_error(errors::NatureErrorCode::ConfigurationError,
                                                                       "Nature repository is not configured."));
    }

    if (!request.valid())
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(errors::make_nature_error(errors::NatureErrorCode::InvalidInput,
                                                                       "The environment state request is invalid."));
    }

    auto area_result =
        get_natural_area(request.natural_area_id);

    if (area_result.failed())
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(area_result.error());
    }

    domain::EnvironmentState state{
        request.natural_area_id,
        request.terrain_condition,
        request.vegetation_condition,
        request.ambient_description,
        request.vegetation_density,
        request.water_level,
        now_seconds()};

    auto status =
        repository_->save_environment_state(state);

    if (status.failed())
    {
      return NatureServiceResult<
          domain::EnvironmentState>::failure(status.error());
    }

    return NatureServiceResult<
        domain::EnvironmentState>::success(std::move(state));
  }

  std::int64_t NatureService::now_seconds()
  {
    return std::chrono::duration_cast<
               std::chrono::seconds>(
               std::chrono::system_clock::now()
                   .time_since_epoch())
        .count();
  }

  std::string NatureService::make_identifier(
      const std::string &prefix)
  {
    static thread_local std::mt19937_64 generator{
        std::random_device{}()};

    const auto timestamp =
        static_cast<std::uint64_t>(
            std::chrono::high_resolution_clock::now()
                .time_since_epoch()
                .count());

    const auto random_a = generator();
    const auto random_b = generator();

    std::ostringstream output;

    output << prefix << "_"
           << std::hex
           << std::setfill('0')
           << std::setw(16)
           << timestamp
           << std::setw(16)
           << random_a
           << std::setw(16)
           << random_b;

    return output.str();
  }
} // namespace orelunza::nature::services
