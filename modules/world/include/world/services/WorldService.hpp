/**
 *
 * @file WorldService.hpp
 * @author Softadastra
 * @brief Application service for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_SERVICES_WORLD_SERVICE_HPP_INCLUDED
#define ORELUNZA_WORLD_SERVICES_WORLD_SERVICE_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>

#include <world/domain/HumanPosition.hpp>
#include <world/domain/Place.hpp>
#include <world/domain/Region.hpp>
#include <world/domain/WorldIds.hpp>
#include <world/errors/WorldError.hpp>
#include <world/repositories/WorldRepository.hpp>

#include <cstdint>
#include <optional>
#include <utility>
#include <vector>

namespace orelunza::world::services
{
  /**
   * @brief Result returned by world service operations.
   *
   * @tparam T Successful value type.
   */
  template <typename T>
  class WorldServiceResult
  {
  public:
    /**
     * @brief Create a successful service result.
     *
     * @param value Successful result value.
     * @return Successful service result.
     */
    [[nodiscard]] static WorldServiceResult success(T value)
    {
      return WorldServiceResult{
          std::move(value),
          errors::make_world_ok()};
    }

    /**
     * @brief Create a failed service result.
     *
     * @param error World service error.
     * @return Failed service result.
     */
    [[nodiscard]] static WorldServiceResult failure(
        errors::WorldError error)
    {
      return WorldServiceResult{
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
     * @brief Return the successful value.
     *
     * @return Mutable successful value.
     */
    [[nodiscard]] T &value()
    {
      return value_.value();
    }

    /**
     * @brief Return the successful value.
     *
     * @return Immutable successful value.
     */
    [[nodiscard]] const T &value() const
    {
      return value_.value();
    }

    /**
     * @brief Return the operation error.
     *
     * @return World error.
     */
    [[nodiscard]] const errors::WorldError &
    error() const noexcept
    {
      return error_;
    }

  private:
    WorldServiceResult(
        std::optional<T> value,
        errors::WorldError error)
        : value_(std::move(value)),
          error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::WorldError error_;
  };

  /**
   * @brief Status returned by service operations without a value.
   */
  class WorldServiceStatus
  {
  public:
    /**
     * @brief Create a successful service status.
     *
     * @return Successful status.
     */
    [[nodiscard]] static WorldServiceStatus success()
    {
      return WorldServiceStatus{
          errors::make_world_ok()};
    }

    /**
     * @brief Create a failed service status.
     *
     * @param error World service error.
     * @return Failed status.
     */
    [[nodiscard]] static WorldServiceStatus failure(
        errors::WorldError error)
    {
      return WorldServiceStatus{
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
     * @return World error.
     */
    [[nodiscard]] const errors::WorldError &
    error() const noexcept
    {
      return error_;
    }

  private:
    explicit WorldServiceStatus(
        errors::WorldError error)
        : error_(std::move(error))
    {
    }

    errors::WorldError error_;
  };

  /**
   * @brief Public overview of the Orelunza world.
   */
  struct WorldOverview
  {
    domain::WorldId id;
    std::vector<domain::Region> regions;
  };

  /**
   * @brief Request used to move a human inside the world.
   */
  struct MoveHumanRequest
  {
    identity::domain::HumanId human_id;
    domain::RegionId region_id;
    std::optional<domain::PlaceId> place_id;

    std::int64_t position_x = 0;
    std::int64_t position_y = 0;

    /**
     * @brief Return whether the request contains valid values.
     *
     * @return true when the request is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return human_id.valid() &&
             region_id.valid() &&
             (!place_id.has_value() ||
              place_id->valid());
    }
  };

  /**
   * @brief Coordinates public world operations.
   */
  class WorldService
  {
  public:
    /**
     * @brief Construct the world service.
     *
     * @param repository World persistence repository.
     */
    explicit WorldService(
        repositories::WorldRepository &repository);

    /**
     * @brief Return the public world overview.
     *
     * Disabled regions are not exposed.
     *
     * @return World overview.
     */
    [[nodiscard]] WorldServiceResult<WorldOverview>
    get_world() const;

    /**
     * @brief Return a public region.
     *
     * @param region_id Region identifier.
     * @return Enabled region.
     */
    [[nodiscard]] WorldServiceResult<domain::Region>
    get_region(
        const domain::RegionId &region_id) const;

    /**
     * @brief List public world regions.
     *
     * Disabled regions are not exposed.
     *
     * @return Enabled regions.
     */
    [[nodiscard]] WorldServiceResult<
        std::vector<domain::Region>>
    list_regions() const;

    /**
     * @brief List public places belonging to a region.
     *
     * Disabled places are not exposed.
     *
     * @param region_id Region identifier.
     * @return Enabled region places.
     */
    [[nodiscard]] WorldServiceResult<
        std::vector<domain::Place>>
    list_places(
        const domain::RegionId &region_id) const;

    /**
     * @brief Return a public place.
     *
     * @param place_id Place identifier.
     * @return Enabled place.
     */
    [[nodiscard]] WorldServiceResult<domain::Place>
    get_place(
        const domain::PlaceId &place_id) const;

    /**
     * @brief Return the current position of a human.
     *
     * @param human_id Human identifier.
     * @return Human position.
     */
    [[nodiscard]] WorldServiceResult<
        domain::HumanPosition>
    get_human_position(
        const identity::domain::HumanId &human_id) const;

    /**
     * @brief Move a human to a region and optional place.
     *
     * @param request Movement request.
     * @return Persisted human position.
     */
    [[nodiscard]] WorldServiceResult<
        domain::HumanPosition>
    move_human(const MoveHumanRequest &request);

  private:
    /**
     * @brief Return the current time in epoch seconds.
     *
     * @return Current epoch time.
     */
    [[nodiscard]] static std::int64_t now_seconds();

    repositories::WorldRepository *repository_ = nullptr;
  };
} // namespace orelunza::world::services

#endif // ORELUNZA_WORLD_SERVICES_WORLD_SERVICE_HPP_INCLUDED
