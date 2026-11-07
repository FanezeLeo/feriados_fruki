---
date: 2026-10-23
type: feature
title: Adicionar eventos de impacto por localidade e intervalo
tags: [api]
---

Adiciona o endpoint publico `GET /v1/impact-events/location/:location?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`,
que retorna todos os eventos de impacto aplicaveis a uma localidade (pais, estado ou
municipio) no intervalo informado, sem paginacao.

A consulta considera a hierarquia nacional, estadual e municipal e omite eventos
cancelados.
