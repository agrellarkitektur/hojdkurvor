/*
 * Tema (Blueprint, Ljust, Mörkt). Laddas först i <head> så att sidan ritas i rätt tema direkt.
 * Valet sparas i webbläsaren. Utan sparat val följer sidan datorns mörka läge.
 * Interna namn: ritning = Blueprint, lugn = Ljust, mork = Mörkt (de är kvar så att sparade val fungerar).
 */
(function () {
  'use strict';
  const TEMAN = ['ritning', 'lugn', 'mork'];
  const NYCKEL = 'terrang-tema';
  let sparat = null;
  try { sparat = localStorage.getItem(NYCKEL); } catch (e) { /* ignoreras */ }
  const morkt = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const start = TEMAN.includes(sparat) ? sparat : (morkt ? 'mork' : 'ritning');
  document.documentElement.dataset.tema = start;

  const Tema = window.Tema = {
    TEMAN,
    NAMN: { ritning: 'Blueprint', lugn: 'Ljust', mork: 'Mörkt' },
    get aktuellt() { return document.documentElement.dataset.tema; },
    satt(t) {
      if (!TEMAN.includes(t)) return;
      document.documentElement.dataset.tema = t;
      try { localStorage.setItem(NYCKEL, t); } catch (e) { /* ignoreras */ }
      document.dispatchEvent(new CustomEvent('temabyte', { detail: t }));
    },
    /** Värdet av en färgvariabel i aktuellt tema, t.ex. Tema.farg('kurva'). */
    farg(namn) { return getComputedStyle(document.documentElement).getPropertyValue('--' + namn).trim(); },
  };

  /** Temaväljaren i huvudmenyn: klick eller hovring fäller ut menyn. */
  function kopplaValjare() {
    const ruta = document.querySelector('.tema-val');
    if (!ruta) return;
    const knapp = ruta.querySelector('.tema-knapp'), meny = ruta.querySelector('.tema-meny'), namn = ruta.querySelector('.tema-namn');
    const val = [...meny.querySelectorAll('[data-val]')];
    const visa = () => {
      namn.textContent = Tema.NAMN[Tema.aktuellt].toUpperCase();
      val.forEach(b => b.setAttribute('aria-checked', String(b.dataset.val === Tema.aktuellt)));
    };
    const oppna = pa => {
      ruta.classList.toggle('oppen', pa);
      knapp.setAttribute('aria-expanded', String(pa));
    };
    knapp.addEventListener('click', e => {
      const pa = !ruta.classList.contains('oppen');
      oppna(pa);
      // flytta fokus in i menyn bara när den öppnas med tangentbordet (detail = 0)
      if (pa && e.detail === 0) (val.find(b => b.dataset.val === Tema.aktuellt) || val[0]).focus();
    });
    val.forEach((b, i) => {
      b.addEventListener('click', () => { Tema.satt(b.dataset.val); oppna(false); knapp.focus(); });
      b.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          val[(i + (e.key === 'ArrowDown' ? 1 : val.length - 1)) % val.length].focus();
        }
      });
    });
    // Stäng vid tryck utanför. pointerdown fungerar även på iPhone, där klick på vanlig text inte alltid ger click-händelser.
    document.addEventListener('pointerdown', e => { if (!ruta.contains(e.target)) oppna(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ruta.classList.contains('oppen')) { oppna(false); knapp.focus(); } });
    // Stäng när fokus tabbas vidare ut ur menyn. Safari på iPhone fokuserar inte knappar vid tryck, så fokus
    // kan försvinna (relatedTarget = null) mitt i ett tryck på ett menyval – då ska menyn inte stängas.
    ruta.addEventListener('focusout', e => { if (e.relatedTarget && !ruta.contains(e.relatedTarget)) oppna(false); });
    document.addEventListener('temabyte', visa);
    visa();
  }

  /** Undersidorna rullar i en egen ruta under menyraden, så att menyn inte flyttar sig när en rullist dyker upp. */
  function fokusRulla() {
    const r = document.querySelector('.rulla');
    if (r && !location.hash && getComputedStyle(r).overflowY === 'auto') r.focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { kopplaValjare(); fokusRulla(); });
  else { kopplaValjare(); fokusRulla(); }
}());
