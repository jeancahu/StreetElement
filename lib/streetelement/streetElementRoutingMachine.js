import { fromLonLat, toLonLat } from "ol/proj.js"; // TODO remove fromLonLat if not used

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementRoutingMachine {
  constructor(params = {}) {
    // params.lonLat // boolean
    // params.object // boolean
    // params.distance // boolean

    var routing_server = "http://router.project-osrm.org/route/v1/driving/";
    var routing_params = "?steps=false&geometries=geojson";

    if (params.routing_machine_url && params.routing_machine_url.length) {
      routing_server = params.routing_machine_url;
    }

    // Private methods
    this.route = async (coordinates) => {
      // async funtion always sends a Promise
      return fetch(
        routing_server +
          toLonLat(coordinates[0]).join() +
          ";" +
          toLonLat(coordinates[1]).join() +
          routing_params
      )
        .then((value) => value.json())
        .catch((error) => console.error(error))
        .then((data) => {
          if (data.code == "Ok") {
            var realcoords;
            if (params.lonLat) {
              realcoords = data.routes[0].geometry.coordinates;
            } else {
              realcoords = data.routes[0].geometry.coordinates.map((value) =>
                fromLonLat(value)
              );
            }

            if (params.object) {
              realcoords = {
                coordinates: realcoords,
              };
              if (params.distance) {
                realcoords["distance"] = data.routes[0].distance;
              }
            }

            return realcoords;
          } else {
            console.error("wrong response");
            return null;
          }
        });
    };

    // ////////////// end constructor
  }

  // Public methods and static functions

  // Create a function for every param to
  // verify if it is a valid valor // TODO
  static isInstance(obj) {
    if (typeof obj == "object") {
      if (obj.constructor.name == streetElementRoutingMachine.name) {
        return true;
      }
    }
    return false;
  }
}
