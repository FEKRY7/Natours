/*eslint-disable*/

export const displayMap = (locations) => {
  
    mapboxgl.accessToken =
      'pk.eyJ1IjoibXVnYTk4IiwiYSI6ImNsMWp3Nzl1azFzeXUzbHJ0dGxycWdiNXEifQ.o5WudgxsQNEWWPNYtcuspQ';
  
    var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/muga98/cl1k6yk2z004t15rjb03rqjxd',
      scrollZoom: false
      // center: [-118.113491, 34.111745],
      // zoom:10,
      // intersctive: false
    });
    const bounds = new mapboxgl.LngLatBounds();
  
    locations.forEach(loc => {
      //create Marker
      const el = document.createElement('div');
      el.className = 'marker';
      //Add Marker
      new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(loc.coordinates)
        .addTo(map);
  
      new mapboxgl.Popup({ offset: 30 })
        .setLngLat(loc.coordinates)
        .setHTML(`<p> ${loc.day}: ${loc.description}</p>`)
        .addTo(map);
      // extend map bounds to include current location
      bounds.extend(loc.coordinates);
    });
    map.fitBounds(bounds, {
      padding: {
        top: 200,
        bottom: 150,
        left: 100,
        right: 100
      }
    });
  }
  