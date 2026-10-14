#include <cmath>
#include <cstddef>

#if defined(_WIN32)
#define GB_EXPORT __declspec(dllexport)
#else
#define GB_EXPORT __attribute__((visibility("default")))
#endif

static double distance_m(double lat1, double lng1, double lat2, double lng2) {
    constexpr double pi = 3.14159265358979323846;
    constexpr double earth_radius = 6371008.8;
    const double a = lat1 * pi / 180.0;
    const double b = lat2 * pi / 180.0;
    const double dlat = b - a;
    const double dlng = (lng2 - lng1) * pi / 180.0;
    double h = std::pow(std::sin(dlat / 2), 2) + std::cos(a) * std::cos(b) * std::pow(std::sin(dlng / 2), 2);
    h = h < 0 ? 0 : (h > 1 ? 1 : h);
    return 2 * earth_radius * std::asin(std::sqrt(h));
}

// Stable C ABI. All points participate; no sampling. Outputs are distances in meters
// and a fraction of points with another record within the given threshold.
extern "C" GB_EXPORT int gb_spatial(const double* lat, const double* lng, std::size_t count,
                                    double threshold_m, double* mean_nearest, double* close_fraction) {
    if (!lat || !lng || !mean_nearest || !close_fraction || count < 2 || count > 2000 ||
        !std::isfinite(threshold_m) || threshold_m < 0) return 1;
    for (std::size_t i = 0; i < count; ++i) {
        if (!std::isfinite(lat[i]) || !std::isfinite(lng[i]) || std::abs(lat[i]) > 90 || std::abs(lng[i]) > 180) return 2;
    }
    double sum = 0;
    std::size_t close = 0;
    for (std::size_t i = 0; i < count; ++i) {
        double nearest = 1e100;
        for (std::size_t j = 0; j < count; ++j) {
            if (i == j) continue;
            const double d = distance_m(lat[i], lng[i], lat[j], lng[j]);
            if (d < nearest) nearest = d;
        }
        sum += nearest;
        if (nearest <= threshold_m) ++close;
    }
    *mean_nearest = sum / static_cast<double>(count);
    *close_fraction = static_cast<double>(close) / static_cast<double>(count);
    return 0;
}
