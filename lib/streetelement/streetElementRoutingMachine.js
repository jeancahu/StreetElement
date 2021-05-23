import { fromLonLat, toLonLat } from 'ol/proj.js'; // TODO remove fromLonLat if not used

//////////////// GTFS streetElements ///////////////////
////                                                ////
////  This library tries to encapsulate some of the ////
////  most necessary tables and elements required   ////
////  by the General Transit Feed Specification,    ////
////  format
////
////

export default class streetElementRoutingMachine {
    constructor (params={}) {

    }

    route = async(coordinates) => {
        // async funtion always sends a Promise
        return fetch("http://161.35.54.122:5000/route/v1/driving/"+toLonLat(coordinates[0]).join()+
              ";"+toLonLat(coordinates[1]).join()+"?steps=false&geometries=geojson")
            .then(value => value.json())
            .catch(error => console.error(error))
            .then(
                data => {
                    if (data.code == 'Ok') {
                        var realcoords = data.routes[0].geometry.coordinates.map(
                            value => fromLonLat(value));
                        return realcoords;
                    } else {
                        console.error("wrong response");
                        return null;
                    }
                });
    }

    // Create a function for every param to
    // verify if it is a valid valor // TODO
    static isInstance ( obj ){
        if (typeof(obj) == "object"){
            if (obj.constructor.name == streetElementRouter.name){
                return true;
            }
        }
        console.log("The variable is not a " + streetElementRouter.name + " instance");
        return false;
    }

}
