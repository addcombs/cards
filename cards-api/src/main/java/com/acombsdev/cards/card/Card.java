package com.acombsdev.cards.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
// The schema comes from DATABASE_SCHEMA (hibernate.default_schema in application.properties).
// Rows come from db/migrations/002-cards.sql; the API only reads them.
@Table(name = "cards")
public class Card {
    @Id
    private Integer id;

    @Column(name = "photo_id")
    private String photoId;

    @Column(name = "cert_number")
    private String certNumber;

    @Column(name = "sport")
    private String sport;

    @Column(name = "year")
    private Integer year;

    @Column(name = "set_name")
    private String setName;

    @Column(name = "card_number")
    private String cardNumber;

    @Column(name = "player")
    private String player;

    @Column(name = "variety")
    private String variety;

    @Column(name = "grade")
    private String grade;

    protected Card() {
    }

    Card(String photoId, String certNumber, String sport, Integer year, String setName, String cardNumber,
         String player, String variety, String grade) {
        this.photoId = photoId;
        this.certNumber = certNumber;
        this.sport = sport;
        this.year = year;
        this.setName = setName;
        this.cardNumber = cardNumber;
        this.player = player;
        this.variety = variety;
        this.grade = grade;
    }

    public Integer getId() {
        return id;
    }

    public String getPhotoId() {
        return photoId;
    }

    public String getCertNumber() {
        return certNumber;
    }

    public String getSport() {
        return sport;
    }

    public Integer getYear() {
        return year;
    }

    public String getSetName() {
        return setName;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public String getPlayer() {
        return player;
    }

    public String getVariety() {
        return variety;
    }

    public String getGrade() {
        return grade;
    }
}
