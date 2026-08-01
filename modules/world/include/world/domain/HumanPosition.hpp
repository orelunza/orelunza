/**
 *
 * @file HumanPosition.hpp
 * @author Softadastra
 * @brief Human world position model for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_DOMAIN_HUMAN_POSITION_HPP_INCLUDED
#define ORELUNZA_WORLD_DOMAIN_HUMAN_POSITION_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>
#include <world/domain/WorldIds.hpp>

#include <cstdint>
#include <optional>
#include <utility>

namespace orelunza::world::domain
{
  /**
   * @brief Represents the current position of an Orelunza human.
   *
   * A human always belongs to a region. The place identifier is optional
   * because the human may be moving between named places.
   */
  class HumanPosition
  {
  public:
    /**
     * @brief Construct an empty human position.
     */
    HumanPosition() = default;

    /**
     * @brief Construct a human position.
     *
     * @param human_id Human identifier from the identity module.
     * @param region_id Current region identifier.
     * @param place_id Current optional place identifier.
     * @param position_x Horizontal world position.
     * @param position_y Vertical world position.
     * @param updated_at Last movement time in epoch seconds.
     */
    HumanPosition(
        identity::domain::HumanId human_id,
        RegionId region_id,
        std::optional<PlaceId> place_id,
        std::int64_t position_x,
        std::int64_t position_y,
        std::int64_t updated_at)
        : human_id_(std::move(human_id)),
          region_id_(std::move(region_id)),
          place_id_(std::move(place_id)),
          position_x_(position_x),
          position_y_(position_y),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the human identifier.
     *
     * @return Human identifier.
     */
    [[nodiscard]] const identity::domain::HumanId &
    human_id() const noexcept
    {
      return human_id_;
    }

    /**
     * @brief Return the current region identifier.
     *
     * @return Region identifier.
     */
    [[nodiscard]] const RegionId &region_id() const noexcept
    {
      return region_id_;
    }

    /**
     * @brief Return the current optional place identifier.
     *
     * @return Optional place identifier.
     */
    [[nodiscard]] const std::optional<PlaceId> &
    place_id() const noexcept
    {
      return place_id_;
    }

    /**
     * @brief Return whether the human is inside a named place.
     *
     * @return true when a place identifier is present.
     */
    [[nodiscard]] bool has_place() const noexcept
    {
      return place_id_.has_value();
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
     * @brief Return the last movement time.
     *
     * @return Update time in epoch seconds.
     */
    [[nodiscard]] std::int64_t updated_at() const noexcept
    {
      return updated_at_;
    }

    /**
     * @brief Return whether the position contains valid domain data.
     *
     * @return true when the position is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return human_id_.valid() &&
             region_id_.valid() &&
             (!place_id_.has_value() ||
              place_id_->valid()) &&
             updated_at_ >= 0;
    }

    /**
     * @brief Test whether this position belongs to a human.
     *
     * @param human_id Expected human identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool belongs_to(
        const identity::domain::HumanId &human_id) const noexcept
    {
      return human_id_ == human_id;
    }

    /**
     * @brief Test whether the human is in a region.
     *
     * @param region_id Expected region identifier.
     * @return true when the region identifiers match.
     */
    [[nodiscard]] bool is_in_region(
        const RegionId &region_id) const noexcept
    {
      return region_id_ == region_id;
    }

    /**
     * @brief Test whether the human is in a place.
     *
     * @param place_id Expected place identifier.
     * @return true when the place identifiers match.
     */
    [[nodiscard]] bool is_in_place(
        const PlaceId &place_id) const noexcept
    {
      return place_id_.has_value() &&
             place_id_.value() == place_id;
    }

    /**
     * @brief Move the human to another region.
     *
     * Changing regions clears the current place because a place belongs to
     * one specific region.
     *
     * @param region_id New region identifier.
     */
    void set_region(RegionId region_id)
    {
      region_id_ = std::move(region_id);
      place_id_.reset();
    }

    /**
     * @brief Set the current place.
     *
     * @param place_id New place identifier.
     */
    void set_place(PlaceId place_id)
    {
      place_id_ = std::move(place_id);
    }

    /**
     * @brief Clear the current named place.
     */
    void clear_place() noexcept
    {
      place_id_.reset();
    }

    /**
     * @brief Replace the current coordinates.
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
     * @brief Change the last movement time.
     *
     * @param updated_at New update time in epoch seconds.
     */
    void set_updated_at(std::int64_t updated_at) noexcept
    {
      updated_at_ = updated_at;
    }

  private:
    identity::domain::HumanId human_id_;
    RegionId region_id_;
    std::optional<PlaceId> place_id_;

    std::int64_t position_x_ = 0;
    std::int64_t position_y_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::world::domain

#endif // ORELUNZA_WORLD_DOMAIN_HUMAN_POSITION_HPP_INCLUDED
