import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { CreateItemDto, Item, UpdateItemDto } from './item.dto';

const COLLECTION = 'items';

@Injectable()
export class ItemsService implements OnModuleInit {
  private db!: admin.firestore.Firestore;

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT,
      });
    }

    this.db = admin.firestore();
  }

  private toItem(id: string, data: FirebaseFirestore.DocumentData): Item {
    const now = new Date().toISOString();

    return {
      id,
      title: data.title ?? '',
      description: data.description ?? '',
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
  }

  async findAll(): Promise<Item[]> {
    const snapshot = await this.db
      .collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.toItem(doc.id, doc.data()));
  }

  async findOne(id: string): Promise<Item> {
    const doc = await this.db.collection(COLLECTION).doc(id).get();

    if (!doc.exists) {
      throw new NotFoundException(`Item ${id} not found`);
    }

    return this.toItem(doc.id, doc.data()!);
  }

  async create(dto: CreateItemDto): Promise<Item> {
    const now = new Date().toISOString();
    const ref = await this.db.collection(COLLECTION).add({
      title: dto.title,
      description: dto.description ?? '',
      createdAt: now,
      updatedAt: now,
    });

    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    await this.findOne(id);

    await this.db.collection(COLLECTION).doc(id).update({
      ...dto,
      updatedAt: new Date().toISOString(),
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.db.collection(COLLECTION).doc(id).delete();
  }
}
