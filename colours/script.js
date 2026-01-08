// script.js

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
        const rgb=hexToRgb(item.Hex);
        const hsl=rgbToHsl(rgb);
        const tr=document.createElement('tr');
        tr.dataset.family=item.Family.toLowerCase();
        tr.dataset.name=item.Name.toLowerCase();
        tr.dataset.year=parseInt(item.Year.replace(/[^\d]/g,''))||0;
        tr.dataset.hex=item.Hex.toLowerCase();
        tr.dataset.hue=hsl.h;
        tr.dataset.lum=hsl.l;
        tr.dataset.sat=hsl.s;

        tr.innerHTML=`
            <td>${item.Family}</td>
            <td>${item.Name}</td>
            <td>${item.Year}</td>
            <td style="background-color:${item.Hex}; width:2em;"></td>
            <td>${item.Hex}</td>
        `;
        tbody.appendChild(tr);
    });
}

function sortTable(data, key, numeric=false){
    return data.slice().sort((a,b)=>{
        if(['hue','lum','sat'].includes(key)) return parseFloat(a[key])-parseFloat(b[key]);
        if(numeric) return parseInt(a[key].replace(/[^\d]/g,'')) - parseInt(b[key].replace(/[^\d]/g,'')) || 0;
        return a[key].localeCompare(b[key]);
    });
}

Papa.parse("/colours.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results){
        let data=results.data;

        // DEFAULT SORT: HUE → LUMINOSITY → SATURATION
        data = data.slice().map(item=>{
            const rgb=hexToRgb(item.Hex);
            const hsl=rgbToHsl(rgb);
            item.hue=hsl.h;
            item.lum=hsl.l;
            item.sat=hsl.s;
            return item;
        }).sort((a,b)=>{
            if(a.hue!==b.hue) return a.hue-b.hue;
            if(a.lum!==b.lum) return a.lum-b.lum;
            return a.sat-b.sat;
        });

        buildTable(data);

        const headers=document.querySelectorAll("#colour-table th");
        headers.forEach((th, idx)=>{
            th.addEventListener('click', ()=>{
                const keyMap=['family','name','year','hex','hue','lum','sat'];
                const key=keyMap[idx] || th.textContent.toLowerCase();
                const numeric=['year'].includes(key);
                data=sortTable(data,key,numeric);
                buildTable(data);
            });
        });
    }
});
