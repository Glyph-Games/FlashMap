import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FlashcardApp from './App';

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FlashcardApp />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
