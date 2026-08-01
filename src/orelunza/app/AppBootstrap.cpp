/**
 * @file AppBootstrap.cpp
 * @brief Startup implementation for the Orelunza backend.
 */

#include <orelunza/app/AppBootstrap.hpp>
#include <orelunza/presentation/middleware/MiddlewareRegistry.hpp>
#include <orelunza/presentation/routes/RouteRegistry.hpp>

#include <identity/IdentityModule.hpp>
#include <nature/NatureModule.hpp>
#include <world/WorldModule.hpp>

#include <vix_app_modules.hpp>

#include <vix.hpp>
#include <vix/db/Database.hpp>
#include <vix/executor/RuntimeExecutor.hpp>
#include <vix/log.hpp>

#include <memory>
#include <string>

namespace orelunza::app
{
  int AppBootstrap::run()
  {
    vix::config::Config cfg{".env"};
    auto executor = std::make_shared<vix::executor::RuntimeExecutor>(1u);

    vix::App app{executor};

    auto database = vix::db::Database::sqlite(
        cfg.getString(
            "DATABASE_SQLITE_PATH",
            cfg.getString(
                "database.sqlite_path",
                "storage/orelunza.db")));

    /*
     * Module initialization order matters:
     *
     * - identity owns IdentityService;
     * - world depends on IdentityService;
     * - nature depends on WorldService;
     * - generated route registration runs only after all modules
     *   have been initialized.
     */
    identity::IdentityModule::initialize(database);

    world::WorldModule::initialize(
        database,
        identity::IdentityModule::service());

    nature::NatureModule::initialize(
        database,
        world::WorldModule::service());

    presentation::middleware::MiddlewareRegistry::register_all(app);

    vix::app_generated::register_app_modules(app);

    presentation::routes::RouteRegistry::register_all(app);

    vix::log::info(
        "Starting orelunza on port {}",
        cfg.getServerPort());

    const int status =
        vix::app_generated::run_app(
            app,
            cfg,
            executor);

    /*
     * Dependent modules must be destroyed before their dependencies.
     */
    nature::NatureModule::shutdown();
    world::WorldModule::shutdown();
    identity::IdentityModule::shutdown();

    return status;
  }
} // namespace orelunza::app
