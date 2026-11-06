package com.acombsdev.cards.card;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardRepository extends JpaRepository<Card, Integer> {
    List<Card> findAllByOrderByYearAscSetNameAscCardNumberAscIdAsc();

    Optional<Card> findByPhotoId(String photoId);
}
