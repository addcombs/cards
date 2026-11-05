package com.acombsdev.cards.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CardRepository extends JpaRepository<Card, Integer> {
    List<Card> findAllByOrderByYearAscSetNameAscCardNumberAscIdAsc();
}
