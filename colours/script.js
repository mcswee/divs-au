
function hexToRgb(hex) {
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
    const bigint = parseInt(hex,16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbToHsl({r,g,b}) {
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;} else {
        const d=max-min;
        s=l>0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
            case r: h=(g-b)/d + (g<b?6:0); break;
            case g: h=(b-r)/d + 2; break;
            case b: h=(r-g)/d + 4; break;
        }
        h/=6;
    }
    return {h,s,l};
}

function buildTable(data){
    const tbody=document.querySelector("#colour-table tbody");
    tbody.innerHTML='';
    data.forEach(item=>{
        const tr=document.createElement('tr');

        tr.dataset.family=item.Family.toLowerCase();
        tr.dataset.name=item.Name.toLowerCase();
        tr.dataset.year=parseInt(item.Year.replace(/[^\d]/g,''))||0;
        tr.dataset.hex=item.Hex.toLowerCase();
        tr.dataset.hue=item.hue;
        tr.dataset.lum=item.lum;
        tr.dataset.sat=item.sat;

        tr.innerHTML=`
            <td>${item.Name}</td>
            <td style="background-color:${item.Hex}; width:2em;"></td>
            <td>${item.Hex}</td>
            <td>${item.Year}</td>
            <!-- hidden columns -->
            <td style="display:none">${item.Family}</td>
            <td style="display:none">${item.hue}</td>
            <td style="display:none">${item.lum}</td>
            <td style="display:none">${item.sat}</td>
        `;
        tbody.appendChild(tr);
    });
}

function sortData(data, key, numeric=false){
    return data.slice().sort((a,b)=>{
        if(['hue','lum','sat'].includes(key)) return a[key]-b[key];
        if(numeric) return parseInt(a[key].replace(/[^\d]/g,'')) - parseInt(b[key].replace(/[^\d]/g,'')) || 0;
        return a[key].localeCompare(b[key]);
    });
}

Papa.parse("colours.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results){
        let data = results.data.map(item=>{
            const rgb=hexToRgb(item.Hex);
            const hsl=rgbToHsl(rgb);
            item.hue=hsl.h;
            item.lum=hsl.l;
            item.sat=hsl.s;
            return item;
        });

        // DEFAULT SORT: Hue → Lum → Sat
        data.sort((a,b)=>{
            if(a.hue!==b.hue) return a.hue-b.hue;
            if(a.lum!==b.lum) return a.lum-b.lum;
            return a.sat-b.sat;
        });

        buildTable(data);

        // create dropdown for sorting
        const sortContainer = document.createElement('div');
        sortContainer.innerHTML = `
            <label for="sort-select">Sort by: </label>
            <select id="sort-select">
                <option value="hue">Hue</option>
                <option value="lum">Luminosity</option>
                <option value="sat">Saturation</option>
                <option value="name">Name</option>
                <option value="hex">Hex</option>
                <option value="year">Year</option>
                <option value="family">Family</option>
            </select>
        `;
        document.querySelector("main").insertBefore(sortContainer, document.querySelector("#colour-table"));

        document.getElementById('sort-select').addEventListener('change', (e)=>{
            const key=e.target.value;
            const numeric=['year'].includes(key);
            const sorted = sortData(data,key,numeric);
            buildTable(sorted);
        });
    }
});
