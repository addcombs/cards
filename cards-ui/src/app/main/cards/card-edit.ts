import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Card, CardService, CardUpdate } from './card.service';

const required = [Validators.required, Validators.pattern(/\S/)];

/** An admin's dialog for editing a card's details; it closes once the API has saved them. */
@Component({
  selector: 'app-card-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './card-edit.html',
  styleUrl: './card-edit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardEditComponent implements OnInit {
  protected readonly sports = ['Baseball', 'Basketball', 'Football', 'Hockey'];
  protected readonly cards = inject(CardService);
  private readonly card = inject<Card>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CardEditComponent>);
  protected readonly form = new FormGroup({
    player: new FormControl('', { nonNullable: true, validators: [...required, Validators.maxLength(255)] }),
    sport: new FormControl('', { nonNullable: true, validators: Validators.required }),
    year: new FormControl<number | null>(null, [Validators.required, Validators.min(1800), Validators.max(2100)]),
    setName: new FormControl('', { nonNullable: true, validators: [...required, Validators.maxLength(255)] }),
    cardNumber: new FormControl('', { nonNullable: true, validators: [...required, Validators.maxLength(20)] }),
    variety: new FormControl('', { nonNullable: true, validators: Validators.maxLength(255) }),
    grade: new FormControl('', { nonNullable: true, validators: Validators.maxLength(20) }),
    certNumber: new FormControl('', { nonNullable: true, validators: Validators.maxLength(20) }),
    ebayUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2048), Validators.pattern(/^\s*(https?:\/\/\S+)?\s*$/)],
    }),
  });
  private initialValues = JSON.stringify(this.normalizedValues());

  ngOnInit(): void {
    const { player, sport, year, setName, cardNumber, variety, grade, certNumber, ebayUrl } = this.card;
    this.form.setValue({
      player, sport, year, setName, cardNumber,
      variety: variety ?? '', grade: grade ?? '', certNumber: certNumber ?? '', ebayUrl: ebayUrl ?? '',
    });
    this.initialValues = JSON.stringify(this.normalizedValues());
    this.cards.clearSaveError();
  }

  protected hasChanges(): boolean {
    return JSON.stringify(this.normalizedValues()) !== this.initialValues;
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.cards.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.hasChanges()) return;
    this.dialogRef.disableClose = true;
    const saved = await this.cards.save(this.card.photoId, this.normalizedValues());
    this.dialogRef.disableClose = false;
    if (saved) this.dialogRef.close();
  }

  private normalizedValues(): CardUpdate {
    const values = this.form.getRawValue();
    return {
      player: values.player.trim(),
      sport: values.sport,
      year: values.year ?? 0,
      setName: values.setName.trim(),
      cardNumber: values.cardNumber.trim(),
      variety: values.variety.trim() || null,
      grade: values.grade.trim() || null,
      certNumber: values.certNumber.trim() || null,
      ebayUrl: values.ebayUrl.trim() || null,
    };
  }
}
