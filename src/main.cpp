/**
 * @file main.cpp
 * @brief Entry point for the orelunza backend application.
 */

#include <orelunza/app/AppBootstrap.hpp>

/**
 * @brief Start the backend application.
 *
 * The main function stays intentionally small. Application setup,
 * middleware registration, route registration, and server startup are
 * delegated to orelunza::app::AppBootstrap.
 *
 * @return Process exit code.
 */
int main()
{
  orelunza::app::AppBootstrap bootstrap;
  return bootstrap.run();
}
