/**
 *
 * @file EnvironmentState.hpp
 * @author Softadastra
 * @brief Environment state domain model for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_DOMAIN_ENVIRONMENT_STATE_HPP_INCLUDED
#define ORELUNZA_NATURE_DOMAIN_ENVIRONMENT_STATE_HPP_INCLUDED

#include <nature/domain/NatureIds.hpp>

#include <cstdint>
#include <string>
#include <utility>

namespace orelunza::nature::domain
{
  /**
   * @brief Represents the current natural state of an area.
   *
   * EnvironmentState describes terrain, vegetation, ambient conditions,
   * vegetation density, and water level without implementing a full dynamic
   * weather system.
   */
  class EnvironmentState
  {
  public:
    /**
     * @brief Minimum supported percentage value.
     */
    static constexpr std::int32_t minimum_level = 0;

    /**
     * @brief Maximum supported percentage value.
     */
    static constexpr std::int32_t maximum_level = 100;

    /**
     * @brief Construct an empty environment state.
     */
    EnvironmentState() = default;

    /**
     * @brief Construct an environment state.
     *
     * @param natural_area_id Natural area identifier.
     * @param terrain_condition Current terrain condition.
     * @param vegetation_condition Current vegetation condition.
     * @param ambient_description Public ambient description.
     * @param vegetation_density Vegetation density between 0 and 100.
     * @param water_level Water level between 0 and 100.
     * @param updated_at Last update time in epoch seconds.
     */
    EnvironmentState(
        NaturalAreaId natural_area_id,
        std::string terrain_condition,
        std::string vegetation_condition,
        std::string ambient_description,
        std::int32_t vegetation_density,
        std::int32_t water_level,
        std::int64_t updated_at)
        : natural_area_id_(std::move(natural_area_id)),
          terrain_condition_(std::move(terrain_condition)),
          vegetation_condition_(
              std::move(vegetation_condition)),
          ambient_description_(
              std::move(ambient_description)),
          vegetation_density_(vegetation_density),
          water_level_(water_level),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the associated natural area identifier.
     *
     * @return Natural area identifier.
     */
    [[nodiscard]] const NaturalAreaId &
    natural_area_id() const noexcept
    {
      return natural_area_id_;
    }

    /**
     * @brief Return the current terrain condition.
     *
     * @return Terrain condition.
     */
    [[nodiscard]] const std::string &
    terrain_condition() const noexcept
    {
      return terrain_condition_;
    }

    /**
     * @brief Return the current vegetation condition.
     *
     * @return Vegetation condition.
     */
    [[nodiscard]] const std::string &
    vegetation_condition() const noexcept
    {
      return vegetation_condition_;
    }

    /**
     * @brief Return the public ambient description.
     *
     * @return Ambient description.
     */
    [[nodiscard]] const std::string &
    ambient_description() const noexcept
    {
      return ambient_description_;
    }

    /**
     * @brief Return the vegetation density.
     *
     * @return Vegetation density between 0 and 100.
     */
    [[nodiscard]] std::int32_t
    vegetation_density() const noexcept
    {
      return vegetation_density_;
    }

    /**
     * @brief Return the water level.
     *
     * @return Water level between 0 and 100.
     */
    [[nodiscard]] std::int32_t water_level() const noexcept
    {
      return water_level_;
    }

    /**
     * @brief Return the last update time.
     *
     * @return Update time in epoch seconds.
     */
    [[nodiscard]] std::int64_t updated_at() const noexcept
    {
      return updated_at_;
    }

    /**
     * @brief Return whether a level value is supported.
     *
     * @param value Percentage value.
     * @return true when the value is between 0 and 100.
     */
    [[nodiscard]] static constexpr bool valid_level(
        std::int32_t value) noexcept
    {
      return value >= minimum_level &&
             value <= maximum_level;
    }

    /**
     * @brief Return whether the environment state is valid.
     *
     * @return true when all required fields and ranges are valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return natural_area_id_.valid() &&
             !terrain_condition_.empty() &&
             !vegetation_condition_.empty() &&
             valid_level(vegetation_density_) &&
             valid_level(water_level_) &&
             updated_at_ >= 0;
    }

    /**
     * @brief Test whether this state belongs to a natural area.
     *
     * @param natural_area_id Expected natural area identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool belongs_to(
        const NaturalAreaId &natural_area_id) const noexcept
    {
      return natural_area_id_ == natural_area_id;
    }

    /**
     * @brief Return whether the natural area contains water.
     *
     * @return true when the water level is greater than zero.
     */
    [[nodiscard]] bool has_water() const noexcept
    {
      return water_level_ > minimum_level;
    }

    /**
     * @brief Replace the terrain condition.
     *
     * @param terrain_condition New terrain condition.
     */
    void set_terrain_condition(
        std::string terrain_condition)
    {
      terrain_condition_ =
          std::move(terrain_condition);
    }

    /**
     * @brief Replace the vegetation condition.
     *
     * @param vegetation_condition New vegetation condition.
     */
    void set_vegetation_condition(
        std::string vegetation_condition)
    {
      vegetation_condition_ =
          std::move(vegetation_condition);
    }

    /**
     * @brief Replace the ambient description.
     *
     * @param ambient_description New ambient description.
     */
    void set_ambient_description(
        std::string ambient_description)
    {
      ambient_description_ =
          std::move(ambient_description);
    }

    /**
     * @brief Change the vegetation density.
     *
     * The caller must provide a value between 0 and 100.
     *
     * @param vegetation_density New vegetation density.
     */
    void set_vegetation_density(
        std::int32_t vegetation_density) noexcept
    {
      vegetation_density_ = vegetation_density;
    }

    /**
     * @brief Change the water level.
     *
     * The caller must provide a value between 0 and 100.
     *
     * @param water_level New water level.
     */
    void set_water_level(
        std::int32_t water_level) noexcept
    {
      water_level_ = water_level;
    }

    /**
     * @brief Change the last update time.
     *
     * @param updated_at New update time in epoch seconds.
     */
    void set_updated_at(std::int64_t updated_at) noexcept
    {
      updated_at_ = updated_at;
    }

  private:
    NaturalAreaId natural_area_id_;

    std::string terrain_condition_;
    std::string vegetation_condition_;
    std::string ambient_description_;

    std::int32_t vegetation_density_ = 0;
    std::int32_t water_level_ = 0;

    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::nature::domain

#endif // ORELUNZA_NATURE_DOMAIN_ENVIRONMENT_STATE_HPP_INCLUDED
