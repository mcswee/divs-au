function renderGeoJson(year) {
    fetch(`/assets/data/${year}.geojson`)
        .then(res => res.json())
        .then(geoData => {
            geoJsonLayer = L.geoJSON(geoData, {
                style: (feature) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];
                    // Safety check: Fallback to Grey if data or state is missing
                    const sName = data ? data.state : 'Unknown';
                    const stateColor = stateStyles[sName]?.color || '#666';
                    
                    return {
                        fillColor: '#fafafa',
                        weight: 1.5,
                        color: stateColor,
                        fillOpacity: 0.1,
                        className: 'division-boundary'
                    };
                }, 

                onEachFeature: (feature, layer) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];

                    // If no data exists for this seat, just bind a basic tooltip and exit
                    if (!data) {
                        layer.bindTooltip("Data missing for this seat");
                        return;
                    }

                    let badgeCount = 0;
                    let badgesList = '';

                    if (data.fed === "TRUE") { badgesList += '<span class="badge fed">FEDERATION</span>'; badgeCount++; }
                    if (data.pm === "TRUE") { badgesList += '<span class="badge pm">PRIME MINISTER</span>'; badgeCount++; }
                    if (data.fem === "TRUE") { badgesList += '<span class="badge fem">WOMAN</span>'; badgeCount++; }
                    if (data.ind === "TRUE") { badgesList += '<span class="badge ind">INDIGENOUS</span>'; badgeCount++; }
                    if (data.geo === "TRUE") { badgesList += '<span class="badge geo">GEOGRAPHIC</span>'; badgeCount++; }
                    if (data.linked === "FALSE") { badgesList += '<span class="badge linked">DRIFTED</span>'; badgeCount++; }
                    if (data.old === "TRUE") { badgesList += '<span class="badge old">COLONIAL</span>'; badgeCount++; }
                    if (data.aus === "FALSE") { badgesList += '<span class="badge nonaus">NON-AUSTRALIAN</span>'; badgeCount++; }

                    let badgesHtml = '';
                    if (badgeCount > 0) {
                        badgesHtml = `
                            <div style="margin-top: 12px; margin-bottom: 12px;">
                                <div style="font-size: 0.85em; color: #888; margin-bottom: 6px; letter-spacing: 0.3px; font-weight: bold;">Division name classification</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 4px;">${badgesList}</div>
                            </div>`;
                    }

                    layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, {
                        sticky: true,
                        direction: 'top',
                        className:'modern-tooltip',
                        offset: [0, 5]
                    });

                    const popupContent = `
                        <div style="border-top: 5px solid ${stateStyles[data.state]?.color || '#ccc'}; padding: 5px; min-width: 240px;">
                            <h2 style="margin: 0 0 2px 0; border-bottom: none; font-size: 1.2rem;">${data.division}</h2>
                            <p style="margin: 0 0 8px 0; color: #666; font-size: 0.85em; letter-spacing: 0.65px;">${data.state}</p>
                            <div style="font-size: 0.9em; line-height: 1.4; margin-bottom: 4px;">
                                <strong>Date created:</strong> ${data.created}<br>
                                <strong>Named for:</strong> ${data.namesake}
                            </div>
                            ${badgesHtml}
                            <div style="margin-top: 16px; padding-top: 2px; border-top: 1px solid #eee;">
                                <div style="font-size: 0.85em; color: #888; margin-bottom: 4px; letter-spacing: 0.3px;">Elected Member</div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-weight: bold; font-size: 1.05em;">${data.winner_name || 'N/A'} ${data.winner_surname || ''}</span>
                                    <span style="background: white; color: ${data.colour || '#333'}; padding: 1px 8px; border: 1px solid ${data.colour || '#333'}; border-radius: 12px; font-size: 10px; font-weight: bold; white-space: nowrap;">
                                        ${(data.party || 'unknown').toUpperCase()}
                                    </span>
                                </div>
                               ${data.note ? `<div style="font-size: 0.85em; margin-top: 8px; padding: 6px; background: #f5f5fa; border-left: 3px solid #ccc; border-radius: 0 4px 4px 0; color: #444; line-height: 1.3;">${data.note}</div>` : ''}
                            </div>
                        </div>`;

                    layer.bindPopup(popupContent);

                    layer.on({
                        mouseover: (e) => {
                            const l = e.target;
                            if (geoJsonLayer.searchActive && !l.isSearchMatch) return;
                            const sName = l.feature.properties.state || data.state;
                            l.setStyle({ 
                                fillOpacity: 0.4, 
                                weight: 4, 
                                color: stateStyles[sName]?.color || '#666' 
                            });
                            l.bringToFront();
                        },
                        mouseout: (e) => {
                            const l = e.target;
                            if (geoJsonLayer.searchActive && !l.isSearchMatch) {
                                l.setStyle({ fillOpacity: 0.05, weight: 0 });
                            } else {
                                geoJsonLayer.resetStyle(l);
                            }
                        }
                    }); 
                } 
            }).addTo(map); 

            setupSearch(geoJsonLayer);
            updateLegend();
        })
        .catch(err => console.error("Error loading GeoJSON:", err)); // Added catch to log the specific error
}
