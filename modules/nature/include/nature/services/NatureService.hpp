/**
 *
 * @file NatureService.hpp
 * @author Softadastra
 * @brief Application service for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_SERVICES_NATURE_SERVICE_HPP_INCLUDED
#define ORELUNZA_NATURE_SERVICES_NATURE_SERVICE_HPP_INCLUDED

#include <nature/domain/Biome.hpp>
#include <nature/domain/EnvironmentState.hpp>
#include <nature/domain/NaturalArea.hpp>
#include <nature/errors/NatureError.hpp>
#include <nature/repositories/NatureRepository.hpp>

#include <world/domain/WorldIds.hpp>

#include <cstdint>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace orelunza::world::services
{
  class WorldService;
}

namespace orelunza::nature::services
{
  /**
   * @brief Result returned by nature service operations.
   *
   * @tparam T Successful value type.
   */
  template <typename T>
  class NatureServiceResult
  {
  public:
    /**
     * @brief Create a successful service result.
     *
     * @param value Successful value.
     * @return Successful service result.
     */
    [[nodiscard]] static NatureServiceResult success(T value)
    {
      return NatureServiceResult{
          std::move(value),
          errors::make_nature_ok()};
    }

    /**
     * @brief Create a failed service result.
     *
     * @param error Nature service error.
     * @return Failed service result.
     */
    [[nodiscard]] static NatureServiceResult failure(
        errors::NatureError error)
    {
      return NatureServiceResult{
          std::nullopt,
          std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when a value is available.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return value_.has_value() &&
             !error_.has_error();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when the operation failed.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the mutable successful value.
     *
     * @return Successful value.
     */
    [[nodiscard]] T &value()
    {
      return value_.value();
    }

    /**
     * @brief Return the immutable successful value.
     *
     * @return Successful value.
     */
    [[nodiscard]] const T &value() const
    {
      return value_.value();
    }

    /**
     * @brief Return the operation error.
     *
     * @return Nature error.
     */
    [[nodiscard]] const errors::NatureError &
    error() const noexcept
    {
      return error_;
    }

  private:
    NatureServiceResult(
        std::optional<T> value,
        errors::NatureError error)
        : value_(std::move(value)),
          error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::NatureError error_;
  };

  /**
   * @brief Status returned by service operations without a value.
   */
  class NatureServiceStatus
  {
  public:
    /**
     * @brief Create a successful service status.
     *
     * @return Successful status.
     */
    [[nodiscard]] static NatureServiceStatus success()
    {
      return NatureServiceStatus{
          errors::make_nature_ok()};
    }

    /**
     * @brief Create a failed service status.
     *
     * @param error Nature service error.
     * @return Failed status.
     */
    [[nodiscard]] static NatureServiceStatus failure(
        errors::NatureError error)
    {
      return NatureServiceStatus{
          std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when no error is present.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return !error_.has_error();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when an error is present.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the operation error.
     *
     * @return Nature error.
     */
    [[nodiscard]] const errors::NatureError &
    error() const noexcept
    {
      return error_;
    }

  private:
    explicit NatureServiceStatus(
        errors::NatureError error)
        : error_(std::move(error))
    {
    }

    errors::NatureError error_;
  };

  /**
   * @brief Public overview of Orelunza nature.
   */
  struct NatureOverview
  {
    std::vector<domain::Biome> biomes;
  };

  /**
   * @brief Request used to create a biome.
   */
  struct CreateBiomeRequest
  {
    std::string name;
    std::string slug;
    std::string description;
    std::string terrain_type;
    std::string vegetation_type;

    bool enabled = true;

    /**
     * @brief Return whether the request is valid.
     *
     * @return true when all required fields are present.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return !name.empty() &&
             !slug.empty() &&
             !terrain_type.empty() &&
             !vegetation_type.empty();
    }
  };

  /**
   * @brief Request used to create a natural area.
   */
  struct CreateNaturalAreaRequest
  {
    domain::BiomeId biome_id;
    world::domain::RegionId region_id;
    std::optional<world::domain::PlaceId> place_id;

    std::string name;
    std::string description;

    bool enabled = true;

    /**
     * @brief Return whether the request is valid.
     *
     * @return true when all required fields are present.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return biome_id.valid() &&
             region_id.valid() &&
             (!place_id.has_value() ||
              place_id->valid()) &&
             !name.empty();
    }
  };

  /**
   * @brief Request used to update an environment state.
   */
  struct UpdateEnvironmentStateRequest
  {
    domain::NaturalAreaId natural_area_id;

    std::string terrain_condition;
    std::string vegetation_condition;
    std::string ambient_description;

    std::int32_t vegetation_density = 0;
    std::int32_t water_level = 0;

    /**
     * @brief Return whether the request is valid.
     *
     * @return true when all values are supported.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return natural_area_id.valid() &&
             !terrain_condition.empty() &&
             !vegetation_condition.empty() &&
             domain::EnvironmentState::valid_level(
                 vegetation_density) &&
             domain::EnvironmentState::valid_level(
                 water_level);
    }
  };

  /**
   * @brief Coordinates public and management nature operations.
   */
  class NatureService
  {
  public:
    /**
     * @brief Construct the nature application service.
     *
     * @param repository Nature persistence repository.
     * @param world_service World service used to validate regions and places.
     */
    NatureService(
        repositories::NatureRepository &repository,
        world::services::WorldService &world_service);

    /**
     * @brief Return the public nature overview.
     *
     * @return Nature overview containing enabled biomes.
     */
    [[nodiscard]] NatureServiceResult<NatureOverview>
    get_nature() const;

    /**
     * @brief List enabled biomes.
     *
     * @return Enabled biomes.
     */
    [[nodiscard]] NatureServiceResult<
        std::vector<domain::Biome>>
    list_biomes() const;

    /**
     * @brief Return an enabled biome.
     *
     * @param biome_id Biome identifier.
     * @return Biome.
     */
    [[nodiscard]] NatureServiceResult<domain::Biome>
    get_biome(
        const domain::BiomeId &biome_id) const;

    /**
     * @brief Return an enabled natural area.
     *
     * @param natural_area_id Natural area identifier.
     * @return Natural area.
     */
    [[nodiscard]] NatureServiceResult<
        domain::NaturalArea>
    get_natural_area(
        const domain::NaturalAreaId &natural_area_id) const;

    /**
     * @brief Return the region-wide natural area for a region.
     *
     * @param region_id World region identifier.
     * @return Region-wide natural area.
     */
    [[nodiscard]] NatureServiceResult<
        domain::NaturalArea>
    get_region_nature(
        const world::domain::RegionId &region_id) const;

    /**
     * @brief Return the natural area attached to a place.
     *
     * @param place_id World place identifier.
     * @return Place natural area.
     */
    [[nodiscard]] NatureServiceResult<
        domain::NaturalArea>
    get_place_nature(
        const world::domain::PlaceId &place_id) const;

    /**
     * @brief List enabled natural areas using a biome.
     *
     * @param biome_id Biome identifier.
     * @return Natural areas.
     */
    [[nodiscard]] NatureServiceResult<
        std::vector<domain::NaturalArea>>
    list_biome_areas(
        const domain::BiomeId &biome_id) const;

    /**
     * @brief Return the current state of a natural area.
     *
     * @param natural_area_id Natural area identifier.
     * @return Environment state.
     */
    [[nodiscard]] NatureServiceResult<
        domain::EnvironmentState>
    get_environment_state(
        const domain::NaturalAreaId &natural_area_id) const;

    /**
     * @brief Create a biome.
     *
     * @param request Biome creation request.
     * @return Created biome.
     */
    [[nodiscard]] NatureServiceResult<domain::Biome>
    create_biome(
        const CreateBiomeRequest &request);

    /**
     * @brief Create a natural area.
     *
     * @param request Natural area creation request.
     * @return Created natural area.
     */
    [[nodiscard]] NatureServiceResult<
        domain::NaturalArea>
    create_natural_area(
        const CreateNaturalAreaRequest &request);

    /**
     * @brief Create or replace an environment state.
     *
     * @param request Environment state update request.
     * @return Persisted environment state.
     */
    [[nodiscard]] NatureServiceResult<
        domain::EnvironmentState>
    update_environment_state(
        const UpdateEnvironmentStateRequest &request);

  private:
    /**
     * @brief Return the current epoch time in seconds.
     *
     * @return Current time.
     */
    [[nodiscard]] static std::int64_t now_seconds();

    /**
     * @brief Generate a stable prefixed identifier.
     *
     * @param prefix Identifier prefix.
     * @return Generated identifier value.
     */
    [[nodiscard]] static std::string make_identifier(
        const std::string &prefix);

    repositories::NatureRepository *repository_ = nullptr;
    world::services::WorldService *world_service_ = nullptr;
  };
} // namespace orelunza::nature::services

#endif // ORELUNZA_NATURE_SERVICES_NATURE_SERVICE_HPP_INCLUDED
