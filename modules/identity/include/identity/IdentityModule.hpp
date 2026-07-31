/**
 *
 * @file IdentityModule.hpp
 * @author Softadastra
 * @brief Composition entry point for the Orelunza identity module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_IDENTITY_IDENTITY_MODULE_HPP_INCLUDED
#define ORELUNZA_IDENTITY_IDENTITY_MODULE_HPP_INCLUDED

namespace vix
{
  class App;
}

namespace vix::db
{
  class Database;
}

namespace orelunza::identity
{
  /**
   * @brief Owns and composes the Orelunza identity module.
   *
   * The application shell initializes the module with the shared database
   * before registering its HTTP routes.
   */
  class IdentityModule
  {
  public:
    /**
     * @brief Return the module name.
     *
     * @return Stable module name.
     */
    [[nodiscard]] static const char *name() noexcept;

    /**
     * @brief Initialize the identity module.
     *
     * This creates the Rix authentication stores, authentication provider,
     * Orelunza identity repository, and identity application service.
     *
     * The database must outlive the identity module.
     *
     * @param database Shared application database.
     */
    static void initialize(vix::db::Database &database);

    /**
     * @brief Return whether the identity module is initialized.
     *
     * @return true when initialization completed successfully.
     */
    [[nodiscard]] static bool initialized() noexcept;

    /**
     * @brief Register the identity HTTP routes.
     *
     * initialize() must be called before this function.
     *
     * @param app Vix application.
     */
    static void register_routes(vix::App &app);

    /**
     * @brief Destroy the identity module runtime.
     *
     * This is primarily useful during controlled application shutdown
     * and isolated tests.
     */
    static void shutdown() noexcept;
  };
} // namespace orelunza::identity

#endif // ORELUNZA_IDENTITY_IDENTITY_MODULE_HPP_INCLUDED
