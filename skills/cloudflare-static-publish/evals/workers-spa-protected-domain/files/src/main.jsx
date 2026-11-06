import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
createRoot(document.getElementById('root')).render(
  <BrowserRouter><Routes><Route path="/" element={<h1>Painel</h1>} /><Route path="/relatorios/:id" element={<h1>Relatório</h1>} /></Routes></BrowserRouter>,
);
