/**
 *
 * @file Place.hpp
 * @author Softadastra
 * @brief Place domain model for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_DOMAIN_PLACE_HPP_INCLUDED
#define ORELUNZA_WORLD_DOMAIN_PLACE_HPP_INCLUDED

#include <world/domain/WorldIds.hpp>

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::world::domain
{
  /**
   * @brief Represents a specific place inside an Orelunza region.
   *
   * Places are public destinations such as rivers, libraries, villages,
   * forests, public squares, or quiet spaces.
   */
  class Place
  {
  public:
    /**
     * @brief Construct an empty place.
     */
    Place() = default;

    /**
     * @brief Construct a place.
     *
     * @param id Place identifier.
     * @param region_id Owning region identifier.
     * @param name Public place name.
     * @param description Public place description.
     * @param type Stable place type.
     * @param position_x Horizontal world position.
     * @param position_y Vertical world position.
     * @param enabled Whether the place can be entered.
     * @param created_at Creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    Place(
        PlaceId id,
        RegionId region_id,
        std::string name,
        std::string description,
        std::string type,
        std::int64_t position_x,
        std::int64_t position_y,
        bool enabled,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          region_id_(std::move(region_id)),
          name_(std::move(name)),
          description_(std::move(description)),
          type_(std::move(type)),
          position_x_(position_x),
          position_y_(position_y),
          enabled_(enabled),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the place identifier.
     *
     * @return Place identifier.
     */
    [[nodiscard]] const PlaceId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the owning region identifier.
     *
     * @return Region identifier.
     */
    [[nodiscard]] const RegionId &region_id() const noexcept
    {
      return region_id_;
    }

    /**
     * @brief Return the public place name.
     *
     * @return Place name.
     */
    [[nodiscard]] const std::string &name() const noexcept
    {
      return name_;
    }

    /**
     * @brief Return the place description.
     *
     * @return Place description.
     */
    [[nodiscard]] const std::string &description() const noexcept
    {
      return description_;
    }

    /**
     * @brief Return the stable place type.
     *
     * @return Place type.
     */
    [[nodiscard]] const std::string &type() const noexcept
    {
      return type_;
    }

    /**
     * @brief Return the horizontal world position.
     *
     * @return Horizontal coordinate.
     */
    [[nodiscard]] std::int64_t position_x() const noexcept
    {
      return position_x_;
    }

    /**
     * @brief Return the vertical world position.
     *
     * @return Vertical coordinate.
     */
    [[nodiscard]] std::int64_t position_y() const noexcept
    {
      return position_y_;
    }

    /**
     * @brief Return whether the place is enabled.
     *
     * @return true when the place can be entered.
     */
    [[nodiscard]] bool enabled() const noexcept
    {
      return enabled_;
    }

    /**
     * @brief Return whether the place is disabled.
     *
     * @return true when the place cannot be entered.
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
     * @brief Return whether the place contains valid domain data.
     *
     * @return true when the place is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             region_id_.valid() &&
             !name_.empty() &&
             !type_.empty() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this place has an identifier.
     *
     * @param id Expected place identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(const PlaceId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this place belongs to a region.
     *
     * @param region_id Expected region identifier.
     * @return true when the region identifiers match.
     */
    [[nodiscard]] bool belongs_to(
        const RegionId &region_id) const noexcept
    {
      return region_id_ == region_id;
    }

    /**
     * @brief Test whether this place has a type.
     *
     * @param type Expected place type.
     * @return true when the types match.
     */
    [[nodiscard]] bool has_type(std::string_view type) const noexcept
    {
      return type_ == type;
    }

    /**
     * @brief Replace the place name.
     *
     * @param name New place name.
     */
    void set_name(std::string name)
    {
      name_ = std::move(name);
    }

    /**
     * @brief Replace the place description.
     *
     * @param description New place description.
     */
    void set_description(std::string description)
    {
      description_ = std::move(description);
    }

    /**
     * @brief Replace the place type.
     *
     * @param type New place type.
     */
    void set_type(std::string type)
    {
      type_ = std::move(type);
    }

    /**
     * @brief Replace the place position.
     *
     * @param position_x New horizontal coordinate.
     * @param position_y New vertical coordinate.
     */
    void set_position(
        std::int64_t position_x,
        std::int64_t position_y) noexcept
    {
      position_x_ = position_x;
      position_y_ = position_y;
    }

    /**
     * @brief Change the place activation state.
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
    PlaceId id_;
    RegionId region_id_;

    std::string name_;
    std::string description_;
    std::string type_;

    std::int64_t position_x_ = 0;
    std::int64_t position_y_ = 0;

    bool enabled_ = true;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::world::domain

#endif // ORELUNZA_WORLD_DOMAIN_PLACE_HPP_INCLUDED
