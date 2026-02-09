---
layout: default
title: Redistribution submission reports | diva.au
permalink: /reports/
---

<header class="page-element">
    <h1>Electoral division redistributions</h1>
    <p>A comprehensive archive of my formal suggestions to the Australian Electoral Commission for the redistribution of federal electoral divisions. I have actively participated in every federal redistribution cycle since 2014, providing thorough and comprehensive statewide suggestions for boundaries and division names.</p>
    <p>Select a state below to explore my suggestions.</p>
</header>

<section class="page-element">
    <h2>My approach to redistributions</h2>
    <nav class="card-grid" aria-label="Redistribution background">
        <a href="/methodology/" class="state-card">Methodology</a>
        <a href="/naming/" class="state-card">Naming conventions</a>
    </nav>
</section>

{% assign sections = "active,deferred,archived" | split: "," %}
{% assign headings = "Current redistributions,Deferred redistributions,Previous redistributions" | split: "," %}

{% for s in sections %}
    {% assign filtered = site.reports | where: "status", s %}
    {% if filtered.size > 0 %}
        <section class="page-element">
            <h2 id="heading-{{ s }}">{{ headings[forloop.index0] }}</h2>
            <nav class="card-grid" aria-labelledby="heading-{{ s }}">
                {% for report in filtered %}
                <a href="{{ report.url }}" class="state-card" style="--state-color: {{ report.state_color }}; --state-bg: {{ report.state_bg | default: '#f0f0f0' }};">
                    {{ report.state }} 
                    <span class="status {{ report.status }}">{{ report.status }}</span>
                </a>
                {% endfor %}
            </nav>
        </section>
    {% endif %}
{% endfor %}
