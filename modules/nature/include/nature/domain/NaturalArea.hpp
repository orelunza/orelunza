/**
 *
 * @file NaturalArea.hpp
 * @author Softadastra
 * @brief Natural area domain model for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_DOMAIN_NATURAL_AREA_HPP_INCLUDED
#define ORELUNZA_NATURE_DOMAIN_NATURAL_AREA_HPP_INCLUDED

#include <nature/domain/NatureIds.hpp>

#include <world/domain/WorldIds.hpp>

#include <cstdint>
#include <optional>
#include <string>
#include <utility>

namespace orelunza::nature::domain
{
  /**
   * @brief Represents a natural area attached to a world region or place.
   *
   * A natural area always belongs to a region. It may optionally target
   * one specific place inside that region.
   */
  class NaturalArea
  {
  public:
    /**
     * @brief Construct an empty natural area.
     */
    NaturalArea() = default;

    /**
     * @brief Construct a natural area.
     *
     * @param id Natural area identifier.
     * @param biome_id Associated biome identifier.
     * @param region_id Associated world region identifier.
     * @param place_id Optional associated world place identifier.
     * @param name Public natural area name.
     * @param description Public natural area description.
     * @param enabled Whether the natural area is available.
     * @param created_at Creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    NaturalArea(
        NaturalAreaId id,
        BiomeId biome_id,
        world::domain::RegionId region_id,
        std::optional<world::domain::PlaceId> place_id,
        std::string name,
        std::string description,
        bool enabled,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          biome_id_(std::move(biome_id)),
          region_id_(std::move(region_id)),
          place_id_(std::move(place_id)),
          name_(std::move(name)),
          description_(std::move(description)),
          enabled_(enabled),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the natural area identifier.
     *
     * @return Natural area identifier.
     */
    [[nodiscard]] const NaturalAreaId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the associated biome identifier.
     *
     * @return Biome identifier.
     */
    [[nodiscard]] const BiomeId &biome_id() const noexcept
    {
      return biome_id_;
    }

    /**
     * @brief Return the associated region identifier.
     *
     * @return Region identifier.
     */
    [[nodiscard]] const world::domain::RegionId &
    region_id() const noexcept
    {
      return region_id_;
    }

    /**
     * @brief Return the optional associated place identifier.
     *
     * @return Optional place identifier.
     */
    [[nodiscard]] const std::optional<world::domain::PlaceId> &
    place_id() const noexcept
    {
      return place_id_;
    }

    /**
     * @brief Return whether the natural area targets a specific place.
     *
     * @return true when a place identifier is present.
     */
    [[nodiscard]] bool has_place() const noexcept
    {
      return place_id_.has_value();
    }

    /**
     * @brief Return whether the natural area applies to an entire region.
     *
     * @return true when no specific place is assigned.
     */
    [[nodiscard]] bool region_wide() const noexcept
    {
      return !has_place();
    }

    /**
     * @brief Return the public natural area name.
     *
     * @return Natural area name.
     */
    [[nodiscard]] const std::string &name() const noexcept
    {
      return name_;
    }

    /**
     * @brief Return the natural area description.
     *
     * @return Natural area description.
     */
    [[nodiscard]] const std::string &
    description() const noexcept
    {
      return description_;
    }

    /**
     * @brief Return whether the natural area is enabled.
     *
     * @return true when the natural area is available.
     */
    [[nodiscard]] bool enabled() const noexcept
    {
      return enabled_;
    }

    /**
     * @brief Return whether the natural area is disabled.
     *
     * @return true when the natural area is unavailable.
     */
    [[nodiscard]] bool disabled() const noexcept
    {
      return !enabled_;
    }

    /**
     * @brief Return the creation time.
     *
     * @return Creation time in epoch seconds.
     */
    [[nodiscard]] std::int64_t created_at() const noexcept
    {
      return created_at_;
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
     * @brief Return whether the natural area contains valid domain data.
     *
     * @return true when the natural area is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             biome_id_.valid() &&
             region_id_.valid() &&
             (!place_id_.has_value() ||
              place_id_->valid()) &&
             !name_.empty() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this natural area has an identifier.
     *
     * @param id Expected natural area identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(
        const NaturalAreaId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether the natural area uses a biome.
     *
     * @param biome_id Expected biome identifier.
     * @return true when the biome identifiers match.
     */
    [[nodiscard]] bool uses_biome(
        const BiomeId &biome_id) const noexcept
    {
      return biome_id_ == biome_id;
    }

    /**
     * @brief Test whether the natural area belongs to a region.
     *
     * @param region_id Expected region identifier.
     * @return true when the region identifiers match.
     */
    [[nodiscard]] bool belongs_to_region(
        const world::domain::RegionId &region_id) const noexcept
    {
      return region_id_ == region_id;
    }

    /**
     * @brief Test whether the natural area targets a place.
     *
     * @param place_id Expected place identifier.
     * @return true when the place identifiers match.
     */
    [[nodiscard]] bool belongs_to_place(
        const world::domain::PlaceId &place_id) const noexcept
    {
      return place_id_.has_value() &&
             place_id_.value() == place_id;
    }

    /**
     * @brief Replace the associated biome.
     *
     * @param biome_id New biome identifier.
     */
    void set_biome(BiomeId biome_id)
    {
      biome_id_ = std::move(biome_id);
    }

    /**
     * @brief Replace the associated region.
     *
     * Changing the region clears the current place because places belong
     * to one specific region.
     *
     * @param region_id New region identifier.
     */
    void set_region(world::domain::RegionId region_id)
    {
      region_id_ = std::move(region_id);
      place_id_.reset();
    }

    /**
     * @brief Assign the natural area to a specific place.
     *
     * @param place_id New place identifier.
     */
    void set_place(world::domain::PlaceId place_id)
    {
      place_id_ = std::move(place_id);
    }

    /**
     * @brief Clear the associated place.
     */
    void clear_place() noexcept
    {
      place_id_.reset();
    }

    /**
     * @brief Replace the natural area name.
     *
     * @param name New natural area name.
     */
    void set_name(std::string name)
    {
      name_ = std::move(name);
    }

    /**
     * @brief Replace the natural area description.
     *
     * @param description New natural area description.
     */
    void set_description(std::string description)
    {
      description_ = std::move(description);
    }

    /**
     * @brief Change the natural area activation state.
     *
     * @param enabled New activation state.
     */
    void set_enabled(bool enabled) noexcept
    {
      enabled_ = enabled;
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
    NaturalAreaId id_;
    BiomeId biome_id_;

    world::domain::RegionId region_id_;
    std::optional<world::domain::PlaceId> place_id_;

    std::string name_;
    std::string description_;

    bool enabled_ = true;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::nature::domain

#endif // ORELUNZA_NATURE_DOMAIN_NATURAL_AREA_HPP_INCLUDED
